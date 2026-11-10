use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum TetrominoType {
    I,
    O,
    T,
    S,
    Z,
    J,
    L,
}

impl TetrominoType {
    pub const ALL: [TetrominoType; 7] = [
        TetrominoType::I,
        TetrominoType::O,
        TetrominoType::T,
        TetrominoType::S,
        TetrominoType::Z,
        TetrominoType::J,
        TetrominoType::L,
    ];
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, Default)]
pub enum RotationState {
    #[default]
    R0 = 0,   // Spawn state
    R90 = 1,  // Clockwise / Right
    R180 = 2, // 180 / Inverted
    R270 = 3, // Counter-clockwise / Left
}

impl RotationState {
    pub fn rotate_cw(self) -> Self {
        match self {
            RotationState::R0 => RotationState::R90,
            RotationState::R90 => RotationState::R180,
            RotationState::R180 => RotationState::R270,
            RotationState::R270 => RotationState::R0,
        }
    }

    pub fn rotate_ccw(self) -> Self {
        match self {
            RotationState::R0 => RotationState::R270,
            RotationState::R90 => RotationState::R0,
            RotationState::R180 => RotationState::R90,
            RotationState::R270 => RotationState::R180,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct ActivePiece {
    pub piece_type: TetrominoType,
    pub rotation: RotationState,
    pub x: i32,
    pub y: i32,
}

impl ActivePiece {
    pub fn new(piece_type: TetrominoType) -> Self {
        // Spawn coordinates on standard 10x40 board (visible rows 20..39, hidden 0..19)
        // I spawns at x=3, y=18 (so blocks lie on row 19)
        // 3x3 pieces spawn at x=3, y=18 or 19
        let (x, y) = match piece_type {
            TetrominoType::I => (3, 18),
            TetrominoType::O => (3, 18),
            _ => (3, 18),
        };

        Self {
            piece_type,
            rotation: RotationState::R0,
            x,
            y,
        }
    }

    /// Returns absolute coordinates of the 4 blocks on the board
    pub fn blocks(&self) -> [(i32, i32); 4] {
        let offsets = get_piece_offsets(self.piece_type, self.rotation);
        [
            (self.x + offsets[0].0, self.y + offsets[0].1),
            (self.x + offsets[1].0, self.y + offsets[1].1),
            (self.x + offsets[2].0, self.y + offsets[2].1),
            (self.x + offsets[3].0, self.y + offsets[3].1),
        ]
    }
}

/// Standard SRS block offsets relative to the piece bounding box top-left (0,0)
pub fn get_piece_offsets(piece: TetrominoType, rotation: RotationState) -> [(i32, i32); 4] {
    match piece {
        TetrominoType::I => match rotation {
            RotationState::R0 => [(0, 1), (1, 1), (2, 1), (3, 1)],
            RotationState::R90 => [(2, 0), (2, 1), (2, 2), (2, 3)],
            RotationState::R180 => [(0, 2), (1, 2), (2, 2), (3, 2)],
            RotationState::R270 => [(1, 0), (1, 1), (1, 2), (1, 3)],
        },
        TetrominoType::O => match rotation {
            _ => [(1, 0), (2, 0), (1, 1), (2, 1)],
        },
        TetrominoType::T => match rotation {
            RotationState::R0 => [(1, 0), (0, 1), (1, 1), (2, 1)],
            RotationState::R90 => [(1, 0), (1, 1), (2, 1), (1, 2)],
            RotationState::R180 => [(0, 1), (1, 1), (2, 1), (1, 2)],
            RotationState::R270 => [(1, 0), (0, 1), (1, 1), (1, 2)],
        },
        TetrominoType::S => match rotation {
            RotationState::R0 => [(1, 0), (2, 0), (0, 1), (1, 1)],
            RotationState::R90 => [(1, 0), (1, 1), (2, 1), (2, 2)],
            RotationState::R180 => [(1, 1), (2, 1), (0, 2), (1, 2)],
            RotationState::R270 => [(0, 0), (0, 1), (1, 1), (1, 2)],
        },
        TetrominoType::Z => match rotation {
            RotationState::R0 => [(0, 0), (1, 0), (1, 1), (2, 1)],
            RotationState::R90 => [(2, 0), (1, 1), (2, 1), (1, 2)],
            RotationState::R180 => [(0, 1), (1, 1), (1, 2), (2, 2)],
            RotationState::R270 => [(1, 0), (0, 1), (1, 1), (0, 2)],
        },
        TetrominoType::J => match rotation {
            RotationState::R0 => [(0, 0), (0, 1), (1, 1), (2, 1)],
            RotationState::R90 => [(1, 0), (2, 0), (1, 1), (1, 2)],
            RotationState::R180 => [(0, 1), (1, 1), (2, 1), (2, 2)],
            RotationState::R270 => [(1, 0), (1, 1), (0, 2), (1, 2)],
        },
        TetrominoType::L => match rotation {
            RotationState::R0 => [(2, 0), (0, 1), (1, 1), (2, 1)],
            RotationState::R90 => [(1, 0), (1, 1), (1, 2), (2, 2)],
            RotationState::R180 => [(0, 1), (1, 1), (2, 1), (0, 2)],
            RotationState::R270 => [(0, 0), (1, 0), (1, 1), (1, 2)],
        },
    }
}
