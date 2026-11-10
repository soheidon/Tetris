use super::piece::TetrominoType;
use rand::rngs::StdRng;
use rand::seq::SliceRandom;
use rand::{RngCore, SeedableRng};
use std::collections::VecDeque;

#[derive(Clone, Debug)]
pub struct SevenBagRandomizer {
    rng: StdRng,
    queue: VecDeque<TetrominoType>,
    seed: u64,
}

impl SevenBagRandomizer {
    /// Creates a new randomizer with an auto-generated random seed
    pub fn new() -> Self {
        let seed = rand::thread_rng().next_u64();
        Self::with_seed(seed)
    }

    /// Creates a new randomizer with a specific fixed seed (for tests/reproducibility)
    pub fn with_seed(seed: u64) -> Self {
        let mut rng = StdRng::seed_from_u64(seed);
        let mut queue = VecDeque::new();

        // Fill initial queue with at least two 7-bags (14 pieces) to easily serve 5-piece lookahead
        let mut bag = TetrominoType::ALL.to_vec();
        bag.shuffle(&mut rng);
        queue.extend(bag);

        let mut bag2 = TetrominoType::ALL.to_vec();
        bag2.shuffle(&mut rng);
        queue.extend(bag2);

        Self { rng, queue, seed }
    }

    pub fn seed(&self) -> u64 {
        self.seed
    }

    /// Pops the next piece from the queue, replenishing bags as needed
    pub fn next_piece(&mut self) -> TetrominoType {
        let piece = self.queue.pop_front().expect("Queue cannot be empty");

        // Keep queue populated with at least 7 items ahead
        if self.queue.len() < 7 {
            let mut new_bag = TetrominoType::ALL.to_vec();
            new_bag.shuffle(&mut self.rng);
            self.queue.extend(new_bag);
        }

        piece
    }

    /// Looks ahead at the next `count` pieces in the queue without consuming them
    pub fn peek_next(&self, count: usize) -> Vec<TetrominoType> {
        self.queue.iter().take(count).copied().collect()
    }
}

impl Default for SevenBagRandomizer {
    fn default() -> Self {
        Self::new()
    }
}
