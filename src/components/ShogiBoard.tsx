"use client";

import React, { useCallback, useMemo, useState } from "react";

// Very light-weight Shogi board with SFEN support and free drag-and-drop moves.
// This is NOT rules-legal validation; it's a visual board that lets you move pieces around.
// SFEN reference: https://en.wikipedia.org/wiki/Shogi_notation#SFEN
// We only handle the board portion of SFEN (first field) for now.

export type ShogiBoardProps = {
  position?: string; // SFEN board string (first field). If undefined, use standard start.
  onPositionChange?: (position: string) => void;
  size?: number; // pixel width/height of the board
};

// Standard Shogi starting position (SFEN first field only)
const SHOGI_START_SFEN =
  "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL";

// Mapping for simple display. We'll use Roman letters and basic Kanji where helpful.
// Uppercase = sente (bottom), lowercase = gote (top)
const PIECE_LABEL: Record<string, string> = {
  p: "歩", // pawn
  l: "香",
  n: "桂",
  s: "銀",
  g: "金",
  b: "角",
  r: "飛",
  k: "王",
  P: "歩",
  L: "香",
  N: "桂",
  S: "銀",
  G: "金",
  B: "角",
  R: "飛",
  K: "玉",
};

type Side = "sente" | "gote";

function getSide(cell: string): Side {
  return /[A-Z]/.test(cell) ? "sente" : "gote";
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 9 && c >= 0 && c < 9;
}

function pathClear(board: (string | null)[][], r1: number, c1: number, r2: number, c2: number): boolean {
  let dr = Math.sign(r2 - r1);
  let dc = Math.sign(c2 - c1);
  let r = r1 + dr;
  let c = c1 + dc;
  while (r !== r2 || c !== c2) {
    if (board[r][c]) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function isGoldMove(side: Side, dr: number, dc: number): boolean {
  const goldMovesSente = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
              [1, 0],
  ];
  const goldMovesGote = [
              [-1, 0],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  const ref = side === "sente" ? goldMovesSente : goldMovesGote;
  return ref.some(([r, c]) => r === dr && c === dc);
}

function isSilverMove(side: Side, dr: number, dc: number): boolean {
  const silverMovesSente = [
    [-1, -1], [-1, 0], [-1, 1],
    [1, -1],            [1, 1],
  ];
  const silverMovesGote = [
    [-1, -1],           [-1, 1],
    [1, -1],  [1, 0],   [1, 1],
  ];
  const ref = side === "sente" ? silverMovesSente : silverMovesGote;
  return ref.some(([r, c]) => r === dr && c === dc);
}

function isKnightMove(side: Side, dr: number, dc: number): boolean {
  if (side === "sente") return dr === -2 && Math.abs(dc) === 1;
  return dr === 2 && Math.abs(dc) === 1;
}

function isPawnMove(side: Side, dr: number, dc: number): boolean {
  if (side === "sente") return dr === -1 && dc === 0;
  return dr === 1 && dc === 0;
}

function isKingMove(dr: number, dc: number): boolean {
  return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && !(dr === 0 && dc === 0);
}

function isRookMove(dr: number, dc: number): boolean {
  return (dr === 0 && dc !== 0) || (dc === 0 && dr !== 0);
}

function isBishopMove(dr: number, dc: number): boolean {
  return Math.abs(dr) === Math.abs(dc) && dr !== 0;
}

function isLanceMove(side: Side, dr: number, dc: number): boolean {
  if (dc !== 0) return false;
  if (side === "sente") return dr < 0; // up only
  return dr > 0; // down only
}

function violatesEndRankRestriction(piece: string, side: Side, toR: number): boolean {
  // Without promotions, disallow moves that would require promotion
  // Pawn/Lance cannot end on last rank; Knight cannot end on last two ranks.
  if (side === "sente") {
    if ((piece === "P" || piece === "L") && toR === 0) return true;
    if (piece === "N" && toR <= 1) return true;
  } else {
    if ((piece === "p" || piece === "l") && toR === 8) return true;
    if (piece === "n" && toR >= 7) return true;
  }
  return false;
}

function isLegalMove(
  board: (string | null)[][],
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  piece: string,
  side: Side
): boolean {
  if (!inBounds(toR, toC)) return false;
  if (fromR === toR && fromC === toC) return false;

  const target = board[toR][toC];
  if (target && getSide(target) === side) return false; // cannot capture own piece

  const dr = toR - fromR;
  const dc = toC - fromC;

  // Last rank restrictions without promotion support
  if (violatesEndRankRestriction(piece, side, toR)) return false;

  const p = piece.toLowerCase();
  switch (p) {
    case "k":
      return isKingMove(dr, dc);
    case "g":
      return isGoldMove(side, dr, dc);
    case "s":
      return isSilverMove(side, dr, dc);
    case "n":
      return isKnightMove(side, dr, dc);
    case "p":
      return isPawnMove(side, dr, dc);
    case "l":
      if (!isLanceMove(side, dr, dc)) return false;
      return pathClear(board, fromR, fromC, toR, toC);
    case "r":
      if (!isRookMove(dr, dc)) return false;
      return pathClear(board, fromR, fromC, toR, toC);
    case "b":
      if (!isBishopMove(dr, dc)) return false;
      return pathClear(board, fromR, fromC, toR, toC);
    default:
      return false;
  }
}

function parseBoardFromSFEN(sfen: string): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: 9 }, () => Array(9).fill(null));
  const rows = sfen.split("/");
  if (rows.length !== 9) return board;
  for (let r = 0; r < 9; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/^[1-9]$/.test(ch)) {
        file += parseInt(ch, 10);
      } else {
        if (file < 9) {
          board[r][file] = ch;
          file += 1;
        }
      }
    }
  }
  return board;
}

function boardToSFEN(board: (string | null)[][]): string {
  const rows: string[] = [];
  for (let r = 0; r < 9; r++) {
    let row = "";
    let empty = 0;
    for (let c = 0; c < 9; c++) {
      const cell = board[r][c];
      if (!cell) {
        empty += 1;
      } else {
        if (empty > 0) {
          row += String(empty);
          empty = 0;
        }
        row += cell;
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join("/");
}

export function ShogiBoard({ position, onPositionChange, size = 450 }: ShogiBoardProps) {
  const [dragFrom, setDragFrom] = useState<{ r: number; c: number } | null>(null);
  const [turn, setTurn] = useState<Side>("sente");

  const sfen = position && position.trim().length > 0 ? position : SHOGI_START_SFEN;
  const board = useMemo(() => parseBoardFromSFEN(sfen), [sfen]);

  const handleDrop = useCallback(
    (toR: number, toC: number) => {
      if (!dragFrom) return;
      const piece = board[dragFrom.r][dragFrom.c];
      if (!piece) { setDragFrom(null); return; }
      const side = getSide(piece);
      if (side !== turn) { setDragFrom(null); return; }

      if (!isLegalMove(board, dragFrom.r, dragFrom.c, toR, toC, piece, side)) {
        setDragFrom(null);
        return;
      }

      const next = board.map((row) => row.slice());
      next[dragFrom.r][dragFrom.c] = null;
      next[toR][toC] = piece;
      const nextSFEN = boardToSFEN(next);
      onPositionChange?.(nextSFEN);
      setTurn((prev) => (prev === "sente" ? "gote" : "sente"));
      setDragFrom(null);
    },
    [board, dragFrom, onPositionChange, turn]
  );

  const squareSize = Math.floor(size / 9);

  return (
    <div className="flex justify-center flex-col items-center gap-2">
      <div className="text-sm text-gray-800 bg-white/70 px-3 py-1 rounded-md shadow">
        Turn: {turn === "sente" ? "Sente (▲)" : "Gote (▽)"}
      </div>
      <div
        className="relative"
        style={{
          width: squareSize * 9,
          height: squareSize * 9,
          border: "2px solid #8b5a2b",
          boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
          borderRadius: 4,
          background: "#f5deb3",
        }}
      >
        {board.map((row, r) => (
          <div key={r} style={{ display: "flex" }}>
            {row.map((cell, c) => {
              const isDark = (r + c) % 2 === 1;
              return (
                <div
                  key={c}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(r, c);
                  }}
                  style={{
                    width: squareSize,
                    height: squareSize,
                    backgroundColor: isDark ? "#d2b48c" : "#f5deb3",
                    border: "1px solid #8b5a2b",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    userSelect: "none",
                  }}
                >
                  {cell && (
                    <div
                      draggable
                      onDragStart={() => setDragFrom({ r, c })}
                      style={{
                        width: Math.floor(squareSize * 0.85),
                        height: Math.floor(squareSize * 0.85),
                        background: "#ffe4b5",
                        border: "1px solid #8b5a2b",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: Math.floor(squareSize * 0.45),
                        fontWeight: 700,
                        color: /[A-Z]/.test(cell) ? "#222" : "#222",
                        transform: /[a-z]/.test(cell) ? "rotate(180deg)" : "none",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                        paddingBottom: 2,
                        opacity: getSide(cell) === turn ? 1 : 0.6,
                      }}
                      title={cell}
                    >
                      {PIECE_LABEL[cell] ?? cell.toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
