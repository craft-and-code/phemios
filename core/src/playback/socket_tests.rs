use super::*;
use std::{net::TcpListener, thread};
use tungstenite::{
    Message,
    protocol::frame::{
        Frame,
        coding::{Data, OpCode},
    },
};

// Implement the library callback: its fixed response/error types are not application errors.
struct Authenticated;
impl tungstenite::handshake::server::Callback for Authenticated {
    fn on_request(
        self,
        request: &tungstenite::handshake::server::Request,
        response: tungstenite::handshake::server::Response,
    ) -> Result<
        tungstenite::handshake::server::Response,
        tungstenite::handshake::server::ErrorResponse,
    > {
        assert_eq!(request.uri().path(), "/api/me/v1/playback");
        assert_eq!(request.headers()["Authorization"], "Bearer fictional");
        Ok(response)
    }
}

fn peer(
    send: impl FnOnce(WebSocket<TcpStream>) + Send + 'static,
) -> (Socket, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let task = thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        tcp.set_write_timeout(Some(Duration::from_secs(3))).unwrap();
        let socket = tungstenite::accept_hdr(tcp, Authenticated).unwrap();
        send(socket);
    });
    (connect(&client).unwrap(), task)
}

fn read(socket: &mut Socket) -> Result<Message, tungstenite::Error> {
    let deadline = std::time::Instant::now() + Duration::from_secs(3);
    loop {
        match socket.read() {
            Err(error) if transient(&error) && std::time::Instant::now() < deadline => {}
            result => return result,
        }
    }
}

#[test]
fn authenticated_transport_retains_small_buffers_and_bounded_timeouts() {
    let (mut socket, task) = peer(|mut socket| {
        assert_eq!(socket.read().unwrap().into_text().unwrap(), "start");
        socket.send(Message::Ping(vec![1, 2, 3].into())).unwrap();
        assert_eq!(socket.read().unwrap(), Message::Pong(vec![1, 2, 3].into()));
        socket.send(Message::Text("saved".into())).unwrap();
    });
    let config = socket.get_config();
    assert_eq!(config.read_buffer_size, 4096);
    assert_eq!(config.write_buffer_size, 0);
    assert_eq!(config.max_write_buffer_size, 65536);
    assert_eq!(config.max_message_size, Some(32768));
    assert_eq!(config.max_frame_size, Some(32768));
    let MaybeTlsStream::Plain(tcp) = socket.get_ref() else {
        panic!("expected isolated cleartext loopback");
    };
    assert_eq!(tcp.read_timeout().unwrap(), Some(Duration::from_millis(20)));
    assert_eq!(tcp.write_timeout().unwrap(), Some(Duration::from_secs(2)));
    socket.send(Message::Text("start".into())).unwrap();
    assert_eq!(
        read(&mut socket).unwrap(),
        Message::Ping(vec![1, 2, 3].into())
    );
    socket.flush().unwrap();
    assert_eq!(read(&mut socket).unwrap().into_text().unwrap(), "saved");
    task.join().unwrap();
}

#[test]
fn transport_accepts_exactly_32_kib_but_rejects_an_oversized_frame() {
    for size in [32768, 32769] {
        let (mut socket, task) = peer(move |mut socket| {
            socket.send(Message::Binary(vec![7; size].into())).unwrap();
        });
        let result = read(&mut socket);
        if size == 32768 {
            assert_eq!(result.unwrap(), Message::Binary(vec![7; size].into()));
        } else {
            assert!(
                matches!(result, Err(tungstenite::Error::Capacity(_))),
                "{result:?}"
            );
        }
        task.join().unwrap();
    }
}

#[test]
fn fragmentation_cannot_bypass_the_32_kib_message_limit() {
    for size in [32768, 32769] {
        let (mut socket, task) = peer(move |mut socket| {
            socket
                .send(Message::Frame(Frame::message(
                    vec![4; 16384],
                    OpCode::Data(Data::Binary),
                    false,
                )))
                .unwrap();
            socket
                .send(Message::Frame(Frame::message(
                    vec![4; size - 16384],
                    OpCode::Data(Data::Continue),
                    true,
                )))
                .unwrap();
        });
        let result = read(&mut socket);
        if size == 32768 {
            assert_eq!(result.unwrap(), Message::Binary(vec![4; size].into()));
        } else {
            assert!(
                matches!(result, Err(tungstenite::Error::Capacity(_))),
                "{result:?}"
            );
        }
        task.join().unwrap();
    }
}
