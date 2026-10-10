//! HQPlayer SDK 6.0.1 XML frames over one serialized LAN socket.
use quick_xml::{Reader, events::Event};
use std::{
    collections::BTreeMap,
    io::{BufReader, Read, Write},
    net::{IpAddr, TcpStream, ToSocketAddrs},
    time::{Duration, Instant},
};
pub(super) type Attributes = BTreeMap<String, String>;
const LIMIT: u64 = 65536;
const TIMEOUT: Duration = Duration::from_secs(3);
struct Deadline {
    socket: TcpStream,
    end: Instant,
}
impl Read for Deadline {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        let left = self
            .end
            .checked_duration_since(Instant::now())
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::TimedOut, "HQPlayer timeout"))?;
        self.socket.set_read_timeout(Some(left))?;
        self.socket.read(buffer)
    }
}
pub(super) struct Connection {
    input: BufReader<Deadline>,
}
pub(super) fn private(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(ip) => ip.is_loopback() || ip.is_private() || ip.is_link_local(),
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.to_ipv4_mapped().is_some_and(|v| private(IpAddr::V4(v)))
        }
    }
}
impl Connection {
    pub(super) fn connect(host: &str, port: u16) -> Result<Self, String> {
        if host.is_empty()
            || host.len() > 253
            || port == 0
            || host.contains(['/', '@', '?', '#'])
            || host.chars().any(char::is_whitespace)
        {
            return Err("Adresse HQPlayer invalide.".into());
        }
        let addresses = (host, port)
            .to_socket_addrs()
            .map_err(|_| "Adresse HQPlayer introuvable.")?
            .collect::<Vec<_>>();
        if addresses.is_empty()
            || addresses.len() > 16
            || addresses.iter().any(|a| !private(a.ip()))
        {
            return Err("HQPlayer nécessite une adresse locale ou réseau privé.".into());
        }
        let mut socket = None;
        for address in addresses {
            if let Ok(stream) = TcpStream::connect_timeout(&address, TIMEOUT) {
                socket = Some(stream);
                break;
            }
        }
        let socket = socket
            .ok_or("Impossible de joindre HQPlayer. Activez le contrôle réseau dans HQPlayer.")?;
        socket
            .set_write_timeout(Some(TIMEOUT))
            .map_err(|_| "Connexion HQPlayer indisponible.")?;
        Ok(Self {
            input: BufReader::new(Deadline {
                socket,
                end: Instant::now() + TIMEOUT,
            }),
        })
    }
    pub(super) fn call(
        &mut self,
        name: &str,
        attrs: &[(&str, String)],
        acknowledge: bool,
    ) -> Result<Attributes, String> {
        let mut frame = format!("<?xml version=\"1.0\"?><{name}");
        for (key, value) in attrs {
            frame.push_str(&format!(" {key}=\"{}\"", quick_xml::escape::escape(value)));
        }
        frame.push_str("/>");
        if frame.len() as u64 > LIMIT {
            return Err("Commande HQPlayer trop grande.".into());
        }
        self.input.get_mut().end = Instant::now() + TIMEOUT;
        self.input
            .get_mut()
            .socket
            .write_all(frame.as_bytes())
            .map_err(|_| "Commande HQPlayer interrompue.")?;
        for _ in 0..8 {
            let (root, values) = read_any(&mut self.input)?;
            if root == name {
                return acknowledge_reply(values, acknowledge);
            }
            // Status notifications may interleave acknowledgements on an already subscribed engine.
            if root != "Status" {
                return Err("Réponse HQPlayer inattendue.".into());
            }
        }
        Err("Trop de notifications HQPlayer sans réponse.".into())
    }
}
#[cfg(test)]
fn read_reply(
    input: impl std::io::BufRead,
    name: &str,
    acknowledge: bool,
) -> Result<Attributes, String> {
    let (root, values) = read_any(input)?;
    if root != name {
        return Err("Réponse HQPlayer inattendue.".into());
    }
    acknowledge_reply(values, acknowledge)
}
fn acknowledge_reply(values: Attributes, acknowledge: bool) -> Result<Attributes, String> {
    if values.get("result").is_some_and(|v| v == "Error")
        || (acknowledge && values.get("result").map(String::as_str) != Some("OK"))
    {
        return Err("HQPlayer a refusé la commande.".into());
    }
    Ok(values)
}
fn read_any(input: impl std::io::BufRead) -> Result<(String, Attributes), String> {
    let mut reader = Reader::from_reader(input.take(LIMIT + 1));
    let mut buffer = Vec::new();
    let mut depth = 0;
    let mut attributes = None;
    let mut root = String::new();
    loop {
        let event = reader
            .read_event_into(&mut buffer)
            .map_err(|_| "Réponse XML HQPlayer invalide ou interrompue.")?;
        if reader.buffer_position() > LIMIT {
            return Err("Réponse HQPlayer trop grande.".into());
        }
        match event {
            Event::Start(ref element) | Event::Empty(ref element) => {
                if depth == 0 {
                    if attributes.is_some() {
                        return Err("Réponse HQPlayer inattendue.".into());
                    }
                    root = element.name().as_ref().to_owned();
                    let mut values = Attributes::new();
                    for attribute in element.attributes() {
                        let attribute = attribute.map_err(|_| "Attribut HQPlayer invalide.")?;
                        let key = attribute.key.as_ref().to_owned();
                        let value = attribute
                            .normalized_value(quick_xml::XmlVersion::Explicit1_0)
                            .map_err(|_| "Attribut HQPlayer invalide.")?
                            .into_owned();
                        if values.len() >= 64 || values.insert(key, value).is_some() {
                            return Err("Attribut HQPlayer invalide.".into());
                        }
                    }
                    attributes = Some(values);
                }
                if depth == 1 && element.name().as_ref() == "metadata" {
                    for attr in element.attributes() {
                        let attr = attr.map_err(|_| "Attribut HQPlayer invalide.")?;
                        if attr.key.as_ref() == "uri"
                            && let Some(values) = attributes.as_mut()
                        {
                            values.insert(
                                "metadata.uri".into(),
                                attr.normalized_value(quick_xml::XmlVersion::Explicit1_0)
                                    .map_err(|_| "Attribut HQPlayer invalide.")?
                                    .into_owned(),
                            );
                        }
                    }
                }
                if matches!(event, Event::Start(_)) {
                    depth += 1;
                    if depth > 8 {
                        return Err("Réponse HQPlayer trop profonde.".into());
                    }
                } else if depth == 0 {
                    break;
                }
            }
            Event::End(_) => {
                if depth == 0 {
                    return Err("Réponse HQPlayer invalide.".into());
                }
                depth -= 1;
                if depth == 0 {
                    break;
                }
            }
            Event::DocType(_) | Event::PI(_) | Event::Eof => {
                return Err("Réponse HQPlayer invalide ou interrompue.".into());
            }
            _ => {}
        }
        buffer.clear();
    }
    attributes
        .map(|values| (root, values))
        .ok_or_else(|| "Réponse HQPlayer invalide.".into())
}
#[cfg(test)]
#[path = "protocol_tests.rs"]
mod tests;
