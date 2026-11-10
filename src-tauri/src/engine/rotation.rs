use super::piece::{RotationState, TetrominoType};

/// Represents an SRS kick offset (dx, dy) in screen coordinates (y-axis points downwards)
pub type KickOffset = (i32, i32);

/// Returns the 5 test kick offsets for a given tetromino and rotation transition
pub fn get_wall_kick_offsets(
    piece: TetrominoType,
    from: RotationState,
    to: RotationState,
) -> &'static [KickOffset; 5] {
    match piece {
        TetrominoType::O => &O_KICKS,
        TetrominoType::I => get_i_kicks(from, to),
        _ => get_jlstz_kicks(from, to),
    }
}

static O_KICKS: [KickOffset; 5] = [(0, 0), (0, 0), (0, 0), (0, 0), (0, 0)];

fn get_jlstz_kicks(from: RotationState, to: RotationState) -> &'static [KickOffset; 5] {
    match (from, to) {
        (RotationState::R0, RotationState::R90) => &JLSTZ_0_TO_1,
        (RotationState::R90, RotationState::R0) => &JLSTZ_1_TO_0,
        (RotationState::R90, RotationState::R180) => &JLSTZ_1_TO_2,
        (RotationState::R180, RotationState::R90) => &JLSTZ_2_TO_1,
        (RotationState::R180, RotationState::R270) => &JLSTZ_2_TO_3,
        (RotationState::R270, RotationState::R180) => &JLSTZ_3_TO_2,
        (RotationState::R270, RotationState::R0) => &JLSTZ_3_TO_0,
        (RotationState::R0, RotationState::R270) => &JLSTZ_0_TO_3,
        _ => &O_KICKS,
    }
}

fn get_i_kicks(from: RotationState, to: RotationState) -> &'static [KickOffset; 5] {
    match (from, to) {
        (RotationState::R0, RotationState::R90) => &I_0_TO_1,
        (RotationState::R90, RotationState::R0) => &I_1_TO_0,
        (RotationState::R90, RotationState::R180) => &I_1_TO_2,
        (RotationState::R180, RotationState::R90) => &I_2_TO_1,
        (RotationState::R180, RotationState::R270) => &I_2_TO_3,
        (RotationState::R270, RotationState::R180) => &I_3_TO_2,
        (RotationState::R270, RotationState::R0) => &I_3_TO_0,
        (RotationState::R0, RotationState::R270) => &I_0_TO_3,
        _ => &O_KICKS,
    }
}

// Screen coords (x right, y down):
// JLSTZ:
static JLSTZ_0_TO_1: [KickOffset; 5] = [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)];
static JLSTZ_1_TO_0: [KickOffset; 5] = [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)];
static JLSTZ_1_TO_2: [KickOffset; 5] = [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)];
static JLSTZ_2_TO_1: [KickOffset; 5] = [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)];
static JLSTZ_2_TO_3: [KickOffset; 5] = [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)];
static JLSTZ_3_TO_2: [KickOffset; 5] = [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)];
static JLSTZ_3_TO_0: [KickOffset; 5] = [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)];
static JLSTZ_0_TO_3: [KickOffset; 5] = [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)];

// I:
static I_0_TO_1: [KickOffset; 5] = [(0, 0), (-2, 0), (1, 0), (-2, 1), (1, -2)];
static I_1_TO_0: [KickOffset; 5] = [(0, 0), (2, 0), (-1, 0), (2, -1), (-1, 2)];
static I_1_TO_2: [KickOffset; 5] = [(0, 0), (-1, 0), (2, 0), (-1, -2), (2, 1)];
static I_2_TO_1: [KickOffset; 5] = [(0, 0), (1, 0), (-2, 0), (1, 2), (-2, -1)];
static I_2_TO_3: [KickOffset; 5] = [(0, 0), (2, 0), (-1, 0), (2, -1), (-1, 2)];
static I_3_TO_2: [KickOffset; 5] = [(0, 0), (-2, 0), (1, 0), (-2, 1), (1, -2)];
static I_3_TO_0: [KickOffset; 5] = [(0, 0), (1, 0), (-2, 0), (1, 2), (-2, -1)];
static I_0_TO_3: [KickOffset; 5] = [(0, 0), (-1, 0), (2, 0), (-1, -2), (2, 1)];
