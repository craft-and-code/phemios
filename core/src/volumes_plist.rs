//! Bounded OS property-list decoding; opaque data is ignored and no device serial is projected.
use quick_xml::{Reader, events::Event};
use serde_json::{Map, Value};
const INVALID: &str = "Métadonnées des lecteurs invalides.";
pub(super) fn parse(bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() > 262144 {
        return Err(INVALID.into());
    }
    let mut reader = Reader::from_reader(bytes);
    reader.config_mut().trim_text(true);
    let mut count = 0;
    loop {
        match reader.read_event().map_err(|_| INVALID)? {
            Event::Start(e) if e.name().as_ref() == "plist" => {}
            Event::Start(e) => return item(&mut reader, e.name().as_ref(), 0, &mut count),
            Event::Decl(_) | Event::DocType(_) => {}
            _ => return Err(INVALID.into()),
        }
    }
}
/// Admit only typed external physical-volume facts; malformed metadata is never an empty discovery.
pub(super) fn external(value: &Value) -> Result<bool, String> {
    let internal = value["Internal"].as_bool().ok_or(INVALID)?;
    let protocol = value["BusProtocol"]
        .as_str()
        .filter(|p| !p.is_empty() && p.len() <= 128 && !p.contains(['<', '>']))
        .ok_or(INVALID)?;
    Ok(!internal && protocol != "Disk Image")
}
fn item(
    reader: &mut Reader<&[u8]>,
    tag: &str,
    depth: usize,
    count: &mut usize,
) -> Result<Value, String> {
    *count += 1;
    if depth > 32 || *count > 16384 {
        return Err(INVALID.into());
    }
    if tag != "dict" && tag != "array" {
        let text = reader
            .read_text(quick_xml::name::QName(tag))
            .map_err(|_| INVALID)?;
        return match tag {
            "integer" => {
                if text.starts_with('-') {
                    text.parse::<i64>()
                        .map(Value::from)
                        .map_err(|_| INVALID.into())
                } else {
                    text.parse::<u64>()
                        .map(Value::from)
                        .map_err(|_| INVALID.into())
                }
            }
            "string" | "key" => quick_xml::escape::unescape(&text)
                .map(|s| Value::String(s.into_owned()))
                .map_err(|_| INVALID.into()),
            "data" | "date" | "real" => Ok(Value::Null),
            _ => Err(INVALID.into()),
        };
    }
    let mut map = Map::new();
    let mut array = Vec::new();
    let mut key = None;
    loop {
        let event = reader.read_event().map_err(|_| INVALID)?;
        let (name, value) = match event {
            Event::End(e) if e.name().as_ref() == tag => break,
            Event::Start(e) => (
                e.name().as_ref().to_owned(),
                item(reader, e.name().as_ref(), depth + 1, count)?,
            ),
            Event::Empty(e) => {
                *count += 1;
                if *count > 16384 {
                    return Err(INVALID.into());
                }
                let value = match e.name().as_ref() {
                    "true" => Value::Bool(true),
                    "false" => Value::Bool(false),
                    "string" | "key" => Value::String(String::new()),
                    "array" => Value::Array(Vec::new()),
                    "dict" => Value::Object(Map::new()),
                    "data" => Value::Null,
                    _ => return Err(INVALID.into()),
                };
                (e.name().as_ref().to_owned(), value)
            }
            _ => return Err(INVALID.into()),
        };
        if tag == "array" {
            array.push(value);
        } else if name == "key" {
            if key.is_some() {
                return Err(INVALID.into());
            }
            key = value.as_str().map(str::to_owned);
        } else {
            let key = key.take().ok_or(INVALID)?;
            if map.insert(key, value).is_some() {
                return Err(INVALID.into());
            }
        }
    }
    if key.is_some() {
        return Err(INVALID.into());
    }
    Ok(if tag == "array" {
        Value::Array(array)
    } else {
        Value::Object(map)
    })
}
#[cfg(test)]
#[path = "volumes_plist_tests.rs"]
mod tests;
