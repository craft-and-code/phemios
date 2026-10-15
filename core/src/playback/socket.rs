use crate::network::Client;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;
use tungstenite::{WebSocket, client::IntoClientRequest, stream::MaybeTlsStream};
pub(super) type Socket = WebSocket<MaybeTlsStream<TcpStream>>;
pub(super) fn connect(client: &Client) -> Result<Socket, String> {
    let (server, token) = client.playback_credentials();
    let address = format!(
        "{}/api/me/v1/playback",
        server
            .replacen("https:", "wss:", 1)
            .replacen("http:", "ws:", 1)
    );
    let mut request = address
        .into_client_request()
        .map_err(|_| "Adresse de lecture invalide.")?;
    let host = request
        .uri()
        .host()
        .ok_or("Serveur audio invalide.")?
        .trim_matches(['[', ']']);
    let port = request
        .uri()
        .port_u16()
        .unwrap_or(if request.uri().scheme_str() == Some("wss") {
            443
        } else {
            80
        });
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|_| "Serveur audio introuvable.")?;
    let mut tcp = None;
    for address in addresses.take(8) {
        if let Ok(stream) = TcpStream::connect_timeout(&address, Duration::from_secs(3)) {
            tcp = Some(stream);
            break;
        }
    }
    let tcp = tcp.ok_or("Impossible de joindre le flux audio Aède.")?;
    tcp.set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|_| "Transport audio indisponible.")?;
    tcp.set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| "Transport audio indisponible.")?;
    request.headers_mut().insert(
        "Authorization",
        format!("Bearer {token}")
            .parse()
            .map_err(|_| "Session audio invalide.")?,
    );
    let config = tungstenite::protocol::WebSocketConfig {
        write_buffer_size: 0,
        max_write_buffer_size: 65536,
        max_message_size: Some(32768),
        max_frame_size: Some(32768),
        ..Default::default()
    };
    let (socket, _) = tungstenite::client_tls_with_config(
        request,
        tcp,
        Some(config),
        client.playback_connector(),
    )
    .map_err(|_| "Flux audio refusé : vérifiez la session et le serveur Aède.")?;
    let tcp = match socket.get_ref() {
        MaybeTlsStream::Plain(tcp) => tcp,
        MaybeTlsStream::Rustls(tls) => &tls.sock,
        _ => return Err("Transport TLS audio indisponible.".into()),
    };
    tcp.set_read_timeout(Some(Duration::from_millis(20)))
        .map_err(|_| "Transport audio indisponible.")?;
    Ok(socket)
}
pub(super) fn transient(error: &tungstenite::Error) -> bool {
    matches!(error,tungstenite::Error::Io(error) if matches!(error.kind(),std::io::ErrorKind::WouldBlock|std::io::ErrorKind::TimedOut))
}
