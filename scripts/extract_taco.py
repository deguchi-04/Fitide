"""Extract the searchable TACO table used by the app from the official PDF."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pdfplumber


def number(value: str | None) -> float:
    if not value or value in {"NA", "Tr", "*"}:
        return 0.0
    match = re.search(r"-?\d+(?:,\d+)?", value)
    return float(match.group(0).replace(",", ".")) if match else 0.0


def rows(page):
    grouped = defaultdict(list)
    for word in page.extract_words(keep_blank_chars=False):
        grouped[round(word["top"], 1)].append(word)
    for words in grouped.values():
        yield sorted(words, key=lambda item: item["x0"])


def cell(words, left: float, right: float) -> str | None:
    values = [word["text"] for word in words if left <= word["x0"] < right]
    return " ".join(values) if values else None


def main(pdf_path: Path, output_path: Path) -> None:
    foods: dict[int, dict[str, object]] = {}
    iron_by_id: dict[int, float] = {}
    vitamin_c_by_id: dict[int, float] = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page_index in range(28, 67, 2):
            for words in rows(pdf.pages[page_index]):
                raw_id = cell(words, 70, 110)
                if not raw_id or not raw_id.isdigit():
                    continue
                food_id = int(raw_id)
                name = cell(words, 110, 375)
                if not name:
                    continue
                foods[food_id] = {
                    "id": str(food_id),
                    "name": name,
                    "calories": number(cell(words, 405, 440)),
                    "protein": number(cell(words, 470, 505)),
                    "carbs": number(cell(words, 585, 625)),
                    "fat": number(cell(words, 505, 545)),
                    "fiber": number(cell(words, 625, 660)),
                    "calcium": number(cell(words, 695, 735)),
                    "iron": 0.0,
                    "vitaminC": 0.0,
                }

        for page_index in range(29, 68, 2):
            for words in rows(pdf.pages[page_index]):
                raw_id = cell(words, 70, 120)
                if not raw_id or not raw_id.isdigit():
                    continue
                food_id = int(raw_id)
                iron_by_id[food_id] = number(cell(words, 215, 250))
                vitamin_c_by_id[food_id] = number(cell(words, 725, 775))

    if len(foods) != 597 or min(foods) != 1 or max(foods) != 597:
        raise RuntimeError(f"Expected TACO IDs 1-597, extracted {len(foods)} records")

    for food_id, food in foods.items():
        food["iron"] = iron_by_id.get(food_id, 0.0)
        food["vitaminC"] = vitamin_c_by_id.get(food_id, 0.0)

    prelude = """import type { Nutrients } from './fit-types';

export interface TacoFood extends Nutrients {
  id: string;
  name: string;
}

// Valores por 100 g de parte comestível. Fonte: TACO, 4.ª ed., NEPA/UNICAMP (2011).
// Gerado de forma reproduzível por scripts/extract_taco.py a partir do PDF oficial.
export const TACO_URL = 'https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf';

export const tacoFoods: TacoFood[] = """
    payload = json.dumps(list(foods.values()), ensure_ascii=False, separators=(",", ":"))
    output_path.write_text(prelude + payload + ";\n", encoding="utf-8")
    print(f"Wrote {len(foods)} foods to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_taco.py input.pdf output.ts")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
