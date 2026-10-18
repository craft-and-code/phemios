//! Project only exact named performers, never fuzzy event-title matches or guessed dates.
use super::INVALID;
use serde_json::{Value, json};
use std::collections::BTreeSet;
fn normalized(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
fn text(value: &Value) -> Option<&str> {
    value.as_str().filter(|v| {
        !v.is_empty() && v.len() <= 4096 && !v.chars().any(|c| c.is_control() && c != '\n')
    })
}
fn link(value: &Value) -> Option<&str> {
    text(value).filter(|v| crate::external_links::browser_url(v).is_ok())
}
pub(super) fn project(value: &Value, artist: &str, page: u32) -> Result<Value, String> {
    let total = value["pagination"]["totalPages"].as_u64().ok_or(INVALID)?;
    if value["success"] != true
        || value["pagination"]["page"].as_u64() != Some(u64::from(page) + 1)
        || total > 100_000
    {
        return Err(INVALID.into());
    }
    let rows = value["events"]
        .as_array()
        .filter(|rows| rows.len() <= 100)
        .ok_or(INVALID)?;
    let mut ids = BTreeSet::new();
    let mut events = BTreeSet::new();
    let mut result = Vec::new();
    for row in rows {
        if !row["deletionStatus"].is_null() {
            continue;
        }
        let performers = row["performer"].as_array().ok_or(INVALID)?;
        let matching: Vec<_> = performers
            .iter()
            .filter(|p| text(&p["name"]).is_some_and(|name| normalized(name) == normalized(artist)))
            .collect();
        if matching.is_empty() {
            continue;
        }
        for performer in matching {
            ids.insert(text(&performer["identifier"]).ok_or(INVALID)?.to_owned());
        }
        let id = text(&row["identifier"]).ok_or(INVALID)?;
        if !events.insert(id) {
            return Err(INVALID.into());
        }
        let ticket = row["offers"]
            .as_array()
            .and_then(|offers| {
                offers
                    .iter()
                    .find(|offer| offer["category"] == "ticketingLinkPrimary")
            })
            .and_then(|offer| link(&offer["url"]));
        let venue = &row["location"];
        let address = &venue["address"];
        let country = &address["addressCountry"];
        let start = text(&row["startDate"]).unwrap_or("");
        let date = start.get(..10).filter(|d| {
            d.bytes().enumerate().all(|(i, b)| {
                if i == 4 || i == 7 {
                    b == b'-'
                } else {
                    b.is_ascii_digit()
                }
            })
        });
        let time = start.get(11..19).filter(|t| {
            t.bytes().enumerate().all(|(i, b)| {
                if i == 2 || i == 5 {
                    b == b':'
                } else {
                    b.is_ascii_digit()
                }
            })
        });
        result.push(json!({"id":id,"title":text(&row["name"]).ok_or(INVALID)?,"url":ticket.or_else(||link(&row["url"])),"date":date,"time":time,"timezone":text(&address["x-timezone"]),"status":text(&row["eventStatus"]),"venue":text(&venue["name"]),"city":text(&address["addressLocality"]),"country":text(&country["name"]),"countryCode":text(&country["identifier"]),"address":text(&address["streetAddress"]),"info":text(&row["description"]),"notice":text(&row["x-subtitle"]),"price":null}));
    }
    if ids.len() > 1 {
        return Err("Plusieurs artistes JamBase portent ce nom : correspondance ambiguë.".into());
    }
    Ok(
        json!({"items":result,"pages":total,"page":page,"artistId":ids.into_iter().next(),"source":"JamBase"}),
    )
}
