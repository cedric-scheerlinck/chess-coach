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
  
  "+p": "と",
  "+l": "成香",
  "+n": "成桂",
  "+s": "成銀",
  "+b": "馬",
  "+r": "龍",
  "+P": "と",
  "+L": "成香",
  "+N": "成桂",
  "+S": "成銀",
  "+B": "馬",
  "+R": "龍",
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
    const row = rows[r];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (/^[1-9]$/.test(ch)) {
        file += parseInt(ch, 10);
      } else if (ch === "+") {
        // promoted piece token is "+X"
        const next = row[i + 1];
        if (next && /[a-zA-Z]/.test(next)) {
          if (file < 9) {
            board[r][file] = "+" + next;
            file += 1;
          }
          i += 1;
        }
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
        if (cell.startsWith("+")) {
          row += cell; // already in +X form
        } else {
          row += cell;
        }
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join("/");
}

function inPromotionZone(side: Side, r: number): boolean {
  return side === "sente" ? r <= 2 : r >= 6;
}

function basePiece(piece: string): string {
  return piece.startsWith("+") ? piece[1] : piece;
}

function isPromotable(piece: string): boolean {
  if (piece.startsWith("+")) return false; // already promoted cannot promote again
  const p = basePiece(piece).toLowerCase();
  return ["p", "l", "n", "s", "r", "b"].includes(p);
}

function promotedVersion(piece: string): string {
  const p = basePiece(piece);
  // Already promoted
  if (piece.startsWith("+")) return piece;
  return "+" + p;
}

function isForcedPromotion(side: Side, toR: number, piece: string): boolean {
  const p = basePiece(piece).toLowerCase();
  if (p === "p" || p === "l") {
    return (side === "sente" && toR === 0) || (side === "gote" && toR === 8);
  }
  if (p === "n") {
    return (side === "sente" && toR <= 1) || (side === "gote" && toR >= 7);
  }
  return false;
}

function isMovePatternLegal(
  board: (string | null)[][],
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  piece: string,
  side: Side
): boolean {
  const target = board[toR][toC];
  if (target && getSide(target) === side) return false;
  const dr = toR - fromR;
  const dc = toC - fromC;

  const promoted = piece.startsWith("+");
  const p = basePiece(piece).toLowerCase();

  if (promoted && ["p", "l", "n", "s"].includes(p)) {
    return isGoldMove(side, dr, dc);
  }
  if (p === "k") return isKingMove(dr, dc);
  if (p === "g") return isGoldMove(side, dr, dc);
  if (p === "s") return isSilverMove(side, dr, dc);
  if (p === "n") return isKnightMove(side, dr, dc);
  if (p === "p") return isPawnMove(side, dr, dc);
  if (p === "l") {
    if (!isLanceMove(side, dr, dc)) return false;
    return pathClear(board, fromR, fromC, toR, toC);
  }
  if (p === "r") {
    if (isRookMove(dr, dc)) return pathClear(board, fromR, fromC, toR, toC);
    if (promoted) {
      // dragon: rook + one-step diagonals
      return Math.abs(dr) === 1 && Math.abs(dc) === 1;
    }
    return false;
  }
  if (p === "b") {
    if (isBishopMove(dr, dc)) return pathClear(board, fromR, fromC, toR, toC);
    if (promoted) {
      // horse: bishop + one-step orthogonals
      return (Math.abs(dr) === 1 && dc === 0) || (Math.abs(dc) === 1 && dr === 0);
    }
    return false;
  }
  return false;
}

export function ShogiBoard({ position, onPositionChange, size = 450 }: ShogiBoardProps) {
  const [dragFrom, setDragFrom] = useState<{ r: number; c: number } | null>(null);
  const [turn, setTurn] = useState<Side>("sente");
  const [pending, setPending] = useState<
    | null
    | { fromR: number; fromC: number; toR: number; toC: number; piece: string; side: Side; forced: boolean }
  >(null);
  const [hands, setHands] = useState<{
    sente: Record<"P" | "L" | "N" | "S" | "G" | "B" | "R", number>;
    gote: Record<"P" | "L" | "N" | "S" | "G" | "B" | "R", number>;
  }>({
    sente: { P: 0, L: 0, N: 0, S: 0, G: 0, B: 0, R: 0 },
    gote: { P: 0, L: 0, N: 0, S: 0, G: 0, B: 0, R: 0 },
  });
  const [dragFromHand, setDragFromHand] = useState<null | { side: Side; piece: "P" | "L" | "N" | "S" | "G" | "B" | "R" }>(null);

  const sfen = position && position.trim().length > 0 ? position : SHOGI_START_SFEN;
  const board = useMemo(() => parseBoardFromSFEN(sfen), [sfen]);

  const handleDrop = useCallback(
    (toR: number, toC: number) => {
      // Handle drops from hand first
      if (dragFromHand) {
        if (board[toR][toC]) { setDragFromHand(null); return; }
        const side = dragFromHand.side;
        if (side !== turn) { setDragFromHand(null); return; }
        const pieceLetter = dragFromHand.piece; // uppercase hand key
        // Convert to board piece by side case
        const boardPiece = side === "sente" ? pieceLetter : pieceLetter.toLowerCase();
        // Drop legality
        // End-rank restriction
        if (pieceLetter === "P" || pieceLetter === "L") {
          if ((side === "sente" && toR === 0) || (side === "gote" && toR === 8)) { setDragFromHand(null); return; }
        }
        if (pieceLetter === "N") {
          if ((side === "sente" && toR <= 1) || (side === "gote" && toR >= 7)) { setDragFromHand(null); return; }
        }
        // Nifu: cannot drop pawn on a file where side already has an unpromoted pawn
        if (pieceLetter === "P") {
          const hasPawnInFile = board.some((row) => row[toC] === (side === "sente" ? "P" : "p"));
          if (hasPawnInFile) { setDragFromHand(null); return; }
        }

        const next = board.map((row) => row.slice());
        next[toR][toC] = boardPiece;
        const nextSFEN = boardToSFEN(next);
        onPositionChange?.(nextSFEN);
        // decrement hand
        setHands((h) => ({
          ...h,
          [side]: { ...h[side], [pieceLetter]: Math.max(0, h[side][pieceLetter] - 1) },
        }));
        setTurn((prev) => (prev === "sente" ? "gote" : "sente"));
        setDragFromHand(null);
        return;
      }

      if (!dragFrom) return;
      const piece = board[dragFrom.r][dragFrom.c];
      if (!piece) { setDragFrom(null); return; }
      const side = getSide(piece);
      if (side !== turn) { setDragFrom(null); return; }

      // pattern legality (ignores last-rank restriction; promotion choice may affect that)
      if (!inBounds(toR, toC)) { setDragFrom(null); return; }
      if (!isMovePatternLegal(board, dragFrom.r, dragFrom.c, toR, toC, piece, side)) {
        setDragFrom(null);
        return;
      }

      const eligible = isPromotable(piece) && (inPromotionZone(side, dragFrom.r) || inPromotionZone(side, toR));
      const forced = eligible && isForcedPromotion(side, toR, piece);

      if (forced) {
        // auto-promote
        const next = board.map((row) => row.slice());
        // capture handling
        const target = next[toR][toC];
        if (target) {
          const capturedBase = basePiece(target).toUpperCase() as "P" | "L" | "N" | "S" | "G" | "B" | "R";
          setHands((h) => ({
            ...h,
            [side]: { ...h[side], [capturedBase]: h[side][capturedBase] + 1 },
          }));
        }
        next[dragFrom.r][dragFrom.c] = null;
        next[toR][toC] = promotedVersion(piece);
        const nextSFEN = boardToSFEN(next);
        onPositionChange?.(nextSFEN);
        setTurn((prev) => (prev === "sente" ? "gote" : "sente"));
        setDragFrom(null);
        return;
      }

      if (eligible) {
        // show UI choice
        setPending({ fromR: dragFrom.r, fromC: dragFrom.c, toR, toC, piece, side, forced: false });
        setDragFrom(null);
        return;
      }

      // not eligible -> normal move
      const next = board.map((row) => row.slice());
      next[dragFrom.r][dragFrom.c] = null;
      next[toR][toC] = piece;
      const nextSFEN = boardToSFEN(next);
      onPositionChange?.(nextSFEN);
      setTurn((prev) => (prev === "sente" ? "gote" : "sente"));
      setDragFrom(null);
    },
    [board, dragFrom, dragFromHand, onPositionChange, turn]
  );

  const squareSize = Math.floor(size / 9);

  return (
    <div className="flex justify-center items-start gap-4">
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
                        width: Math.floor(squareSize * 0.82),
                        height: Math.floor(squareSize * 0.82),
                        background: "linear-gradient(135deg, #ffe4b5, #f3cf96)",
                        // simulate border on clipped shape
                        boxShadow: "0 2px 6px rgba(0,0,0,0.25), inset 0 0 0 2px #8b5a2b",
                        // tip at top so non-rotated (sente) points upward toward opponent
                        clipPath: "polygon(20% 98%, 80% 98%, 94% 68%, 50% 2%, 6% 68%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: Math.floor(squareSize * 0.42),
                        fontWeight: 700,
                        color: cell.startsWith("+") ? "#cc0000" : "#222",
                        transform: /[a-z]/.test(cell) ? "rotate(180deg)" : "none",
                        paddingTop: 2,
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

        {pending && (
          <div
            className="absolute inset-0 bg-black/40 flex items-center justify-center"
            onClick={() => setPending(null)}
          >
            <div className="bg-white rounded-lg shadow-lg p-4 min-w-[240px]" onClick={(e) => e.stopPropagation()}>
              <div className="text-center font-semibold mb-3">Promote this piece?</div>
              <div className="flex gap-3 justify-center">
                <button
                  className="px-3 py-2 rounded bg-indigo-600 text-white"
                  onClick={() => {
                    const next = board.map((row) => row.slice());
                    // capture handling for pending move
                    const target2 = next[pending.toR][pending.toC];
                    if (target2) {
                      const capturedBase = basePiece(target2).toUpperCase() as "P" | "L" | "N" | "S" | "G" | "B" | "R";
                      setHands((h) => ({
                        ...h,
                        [pending.side]: { ...h[pending.side], [capturedBase]: h[pending.side][capturedBase] + 1 },
                      }));
                    }
                    next[pending.fromR][pending.fromC] = null;
                    next[pending.toR][pending.toC] = promotedVersion(pending.piece);
                    const nextSFEN = boardToSFEN(next);
                    onPositionChange?.(nextSFEN);
                    setTurn((prev) => (prev === "sente" ? "gote" : "sente"));
                    setPending(null);
                  }}
                >
                  Promote
                </button>
                <button
                  className="px-3 py-2 rounded bg-gray-200 text-gray-800"
                  onClick={() => {
                    const next = board.map((row) => row.slice());
                    // capture handling for pending move
                    const target2 = next[pending.toR][pending.toC];
                    if (target2) {
                      const capturedBase = basePiece(target2).toUpperCase() as "P" | "L" | "N" | "S" | "G" | "B" | "R";
                      setHands((h) => ({
                        ...h,
                        [pending.side]: { ...h[pending.side], [capturedBase]: h[pending.side][capturedBase] + 1 },
                      }));
                    }
                    next[pending.fromR][pending.fromC] = null;
                    next[pending.toR][pending.toC] = pending.piece;
                    const nextSFEN = boardToSFEN(next);
                    onPositionChange?.(nextSFEN);
                    setTurn((prev) => (prev === "sente" ? "gote" : "sente"));
                    setPending(null);
                  }}
                >
                  Do not promote
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Hands panel on the right */}
      <div className="flex flex-col gap-4 min-w-[160px]">
        <div className="bg-white/80 rounded-md shadow p-2">
          <div className="font-semibold text-sm mb-2">Gote Hand (▽)</div>
          <div className="grid grid-cols-4 gap-2">
            {(["P","L","N","S","G","B","R"] as const).map((k) => (
              <HandPiece
                key={`gote-${k}`}
                label={PIECE_LABEL[k.toLowerCase()] ?? k}
                count={hands.gote[k]}
                enabled={turn === "gote" && hands.gote[k] > 0}
                onDragStart={() => setDragFromHand({ side: "gote", piece: k })}
                onDragEnd={() => setDragFromHand(null)}
              />
            ))}
          </div>
        </div>
        <div className="bg-white/80 rounded-md shadow p-2">
          <div className="font-semibold text-sm mb-2">Sente Hand (▲)</div>
          <div className="grid grid-cols-4 gap-2">
            {(["P","L","N","S","G","B","R"] as const).map((k) => (
              <HandPiece
                key={`sente-${k}`}
                label={PIECE_LABEL[k] ?? k}
                count={hands.sente[k]}
                enabled={turn === "sente" && hands.sente[k] > 0}
                onDragStart={() => setDragFromHand({ side: "sente", piece: k })}
                onDragEnd={() => setDragFromHand(null)}
                tileStyle={{ transform: "rotate(180deg)" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HandPiece({ label, count, enabled, onDragStart, onDragEnd, tileStyle }: {
  label: string;
  count: number;
  enabled: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  tileStyle?: React.CSSProperties;
}) {
  return (
    <div className="relative flex items-center justify-center">
      <div
        draggable={enabled}
        onDragStart={enabled ? onDragStart : undefined}
        onDragEnd={enabled ? onDragEnd : undefined}
        className={`w-10 h-10 flex items-center justify-center text-sm font-bold text-black ${enabled ? "opacity-100" : "opacity-40"}`}
        style={{
          background: "linear-gradient(135deg, #ffe4b5, #f3cf96)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25), inset 0 0 0 2px #8b5a2b",
          clipPath: "polygon(12% 2%, 88% 2%, 98% 30%, 50% 98%, 2% 30%)",
          ...(tileStyle || {}),
        }}
        title={label}
      >
        {label}
      </div>
      {count > 0 && (
        <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {count}
        </div>
      )}
    </div>
  );
}
