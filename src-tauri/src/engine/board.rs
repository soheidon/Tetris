use super::piece::{ActivePiece, TetrominoType};

pub const BOARD_WIDTH: usize = 10;
pub const BOARD_HEIGHT: usize = 40;
pub const VISIBLE_START_ROW: usize = 20;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Board {
    pub cells: [[Option<TetrominoType>; BOARD_WIDTH]; BOARD_HEIGHT],
}

impl Default for Board {
    fn default() -> Self {
        Self::new()
    }
}

impl Board {
    pub fn new() -> Self {
        Self {
            cells: [[None; BOARD_WIDTH]; BOARD_HEIGHT],
        }
    }

    /// Checks if all 4 blocks can legally occupy their positions
    pub fn is_valid_position(&self, blocks: &[(i32, i32); 4]) -> bool {
        for &(x, y) in blocks {
            // Horizontal boundaries
            if x < 0 || x >= BOARD_WIDTH as i32 {
                return false;
            }
            // Floor boundary
            if y >= BOARD_HEIGHT as i32 {
                return false;
            }
            // Cells above the top of the internal board are permissible during rotation/spawn
            if y < 0 {
                continue;
            }
            // Collision with existing locked block
            if self.cells[y as usize][x as usize].is_some() {
                return false;
            }
        }
        true
    }

    /// Checks if an active piece is currently valid on the board
    pub fn is_piece_valid(&self, piece: &ActivePiece) -> bool {
        self.is_valid_position(&piece.blocks())
    }

    /// Locks the piece blocks into the board
    pub fn place_piece(&mut self, piece: &ActivePiece) {
        for &(x, y) in &piece.blocks() {
            if x >= 0 && x < BOARD_WIDTH as i32 && y >= 0 && y < BOARD_HEIGHT as i32 {
                self.cells[y as usize][x as usize] = Some(piece.piece_type);
            }
        }
    }

    /// Clears any full lines and drops the blocks above them downwards.
    /// Returns the indices of cleared lines (bottom-up).
    pub fn clear_lines(&mut self) -> Vec<usize> {
        let mut cleared = Vec::new();
        let mut y = (BOARD_HEIGHT - 1) as i32;

        while y >= 0 {
            let row_idx = y as usize;
            let is_full = self.cells[row_idx].iter().all(|c| c.is_some());

            if is_full {
                cleared.push(row_idx);
                // Shift all rows above down by 1
                for r in (1..=row_idx).rev() {
                    self.cells[r] = self.cells[r - 1];
                }
                // Clear the top row
                self.cells[0] = [None; BOARD_WIDTH];
                // Check the same y again since a new row shifted into it
            } else {
                y -= 1;
            }
        }

        cleared
    }

    /// Returns true if every cell in the board is empty (Perfect Clear condition)
    pub fn is_empty(&self) -> bool {
        self.cells.iter().all(|row| row.iter().all(|c| c.is_none()))
    }

    /// Checks if a piece is locked completely above the visible area (Lock Out)
    pub fn is_all_above_visible(&self, piece: &ActivePiece) -> bool {
        piece.blocks().iter().all(|&(_, y)| y < VISIBLE_START_ROW as i32)
    }

    /// Returns the visible 10x20 portion of the board (rows 20..39)
    pub fn visible_cells(&self) -> Vec<Vec<Option<TetrominoType>>> {
        self.cells[VISIBLE_START_ROW..BOARD_HEIGHT]
            .iter()
            .map(|row| row.to_vec())
            .collect()
    }
}
