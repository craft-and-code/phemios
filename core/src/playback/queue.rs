//! Occurrence-preserving finite queue; shuffle changes only the unplayed tail.
use getrandom::fill;
pub(super) struct Queue {
    order: Vec<usize>,
    cursor: usize,
    shuffled: bool,
}
impl Queue {
    pub fn new(total: usize, index: usize) -> Self {
        Self {
            order: (0..total).collect(),
            cursor: index,
            shuffled: false,
        }
    }
    pub fn index(&self) -> usize {
        self.order[self.cursor]
    }
    pub fn order(&self) -> &[usize] {
        &self.order
    }
    pub fn shuffled(&self) -> bool {
        self.shuffled
    }
    pub fn synchronize(
        &mut self,
        order: &[usize],
        shuffled: bool,
        total: usize,
    ) -> Result<(), String> {
        if order.is_empty()
            || total == 0
            || total > 4096
            || order.len() > total
            || order.iter().any(|index| *index >= total)
            || order
                .iter()
                .copied()
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                != order.len()
        {
            return Err("File de lecture invalide.".into());
        }
        let current = self.index();
        let cursor = order
            .iter()
            .position(|value| *value == current)
            .ok_or("File de lecture invalide.")?;
        self.order = order.to_vec();
        self.cursor = cursor;
        self.shuffled = shuffled;
        Ok(())
    }
    pub fn next(&mut self) -> bool {
        if self.cursor + 1 >= self.order.len() {
            false
        } else {
            self.cursor += 1;
            true
        }
    }
    pub fn advance(&mut self, repeat: &str, natural: bool) -> bool {
        if natural && repeat == "one" {
            return true;
        }
        if self.next() {
            return true;
        }
        if repeat == "all" {
            self.first();
            return true;
        }
        false
    }
    pub fn previous(&mut self) {
        self.cursor = self.cursor.saturating_sub(1);
    }
    pub fn first(&mut self) {
        self.cursor = 0;
    }
    pub fn jump(&mut self, index: usize) -> bool {
        if let Some(cursor) = self.order.iter().position(|value| *value == index) {
            self.cursor = cursor;
            true
        } else {
            false
        }
    }
    pub fn shuffle(&mut self, enabled: bool) -> Result<(), String> {
        let tail = &mut self.order[self.cursor + 1..];
        if enabled && !self.shuffled {
            // Refuse an entropy failure before publishing a reordered queue.
            let mut bytes = vec![0; tail.len().saturating_mul(8)];
            fill(&mut bytes).map_err(|_| "Lecture aléatoire indisponible.".to_owned())?;
            for i in (1..tail.len()).rev() {
                let offset = i * 8;
                let mut word = [0; 8];
                word.copy_from_slice(&bytes[offset..offset + 8]);
                tail.swap(i, (u64::from_le_bytes(word) % (i as u64 + 1)) as usize);
            }
        } else if !enabled {
            tail.sort_unstable();
        }
        self.shuffled = enabled;
        Ok(())
    }
}
#[cfg(test)]
#[path = "queue_tests.rs"]
mod tests;
