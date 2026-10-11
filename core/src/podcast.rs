//! Explicit public RSS/Atom retrieval, isolated from Aède sessions and source-library files.
use std::net::IpAddr;
use std::time::Duration;
use ureq::http::Uri;
use ureq::unversioned::resolver::{DefaultResolver, ResolvedSocketAddrs, Resolver};
use ureq::unversioned::transport::{DefaultConnector, NextTimeout};

fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, d] = ip.octets();
            !ip.is_private()
                && !ip.is_loopback()
                && !ip.is_link_local()
                && !ip.is_documentation()
                && !ip.is_broadcast()
                && a != 0
                && a < 224
                && !(a == 100 && (64..=127).contains(&b))
                && !(a == 198 && (18..=19).contains(&b))
                // IANA protocol space has only the .9/.10 globally reachable exceptions.
                && !(a == 192 && b == 0 && c == 0 && !matches!(d, 9 | 10))
                && !(a == 192 && b == 88 && c == 99)
        }
        IpAddr::V6(ip) => {
            if let Some(ip) = ip.to_ipv4_mapped() {
                return public_ip(IpAddr::V4(ip));
            }
            let s = ip.segments();
            (0x2000..=0x3fff).contains(&s[0])
                && s[0] != 0x2002
                && !(s[0] == 0x2001 && matches!(s[1], 0 | 2 | 0xdb8))
        }
    }
}
/// Only explicit public HTTP(S) feeds without URL credentials/fragments may enter the RSS client.
pub fn feed_address(value: &str) -> Result<Uri, String> {
    if value.len() > 2048 || value.chars().any(char::is_control) || value.contains('#') {
        return Err("Adresse RSS invalide.".into());
    }
    let uri: Uri = value.trim().parse().map_err(|_| "Adresse RSS invalide.")?;
    let authority = uri.authority().ok_or("Adresse RSS invalide.")?;
    let host = uri
        .host()
        .ok_or("Adresse RSS invalide.")?
        .trim_matches(['[', ']']);
    if !matches!(uri.scheme_str(), Some("http" | "https"))
        || authority.as_str().contains('@')
        || !matches!(uri.port_u16(), None | Some(80 | 443))
        || host.eq_ignore_ascii_case("localhost")
        || host.ends_with(".local")
        || host.parse::<IpAddr>().is_ok_and(|ip| !public_ip(ip))
    {
        return Err("Utilisez un flux RSS HTTP/HTTPS public sans identifiants.".into());
    }
    Ok(uri)
}
#[derive(Debug)]
pub(crate) struct PublicResolver;
impl Resolver for PublicResolver {
    fn resolve(
        &self,
        uri: &Uri,
        config: &ureq::config::Config,
        timeout: NextTimeout,
    ) -> Result<ResolvedSocketAddrs, ureq::Error> {
        feed_address(&uri.to_string()).map_err(|_| ureq::Error::HostNotFound)?;
        let addresses = DefaultResolver::default().resolve(uri, config, timeout)?;
        if addresses.iter().any(|address| !public_ip(address.ip())) {
            return Err(ureq::Error::HostNotFound);
        }
        Ok(addresses)
    }
}
/// One bounded, public-only feed client; reading a subscription cache never invokes it.
pub struct FeedClient {
    agent: ureq::Agent,
}
impl Default for FeedClient {
    fn default() -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(15)))
            .max_redirects(3)
            .proxy(None)
            .build();
        Self {
            agent: ureq::Agent::with_parts(config, DefaultConnector::default(), PublicResolver),
        }
    }
}
impl FeedClient {
    /// Read at most eight MiB of UTF-8 XML after explicit subscribe/refresh, with bounded public redirects.
    pub fn read(&self, url: &str) -> Result<String, String> {
        let uri = feed_address(url)?;
        let mut response = self
            .agent
            .get(uri.to_string())
            .header("User-Agent", "Phemios/0.1.0 (Podcast RSS client)")
            .header(
                "Accept",
                "application/rss+xml, application/atom+xml, application/xml, text/xml",
            )
            .call()
            .map_err(|_| "Flux RSS indisponible ou adresse non publique.")?;
        let bytes = response
            .body_mut()
            .with_config()
            .limit(8 * 1024 * 1024)
            .read_to_vec()
            .map_err(|_| "Flux RSS trop grand ou interrompu.")?;
        String::from_utf8(bytes).map_err(|_| "Le flux RSS doit utiliser UTF-8.".into())
    }
}
#[cfg(test)]
#[path = "podcast_tests.rs"]
mod tests;
