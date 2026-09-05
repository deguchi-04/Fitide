"""Convert the official UK CoFID workbook into Fitide's compact food catalog.

Usage:
  python scripts/import_cofid.py <cofid.xlsx> [lib/cofid.ts]
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pandas as pd


def number(value: object) -> float:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return 0.0
    if isinstance(value, str):
        clean = value.strip().lower()
        if clean == "tr":
            return 0.01
        if clean in {"", "n", "nd", "nan"}:
            return 0.0
        clean = clean.replace("<", "").replace(",", ".")
        try:
            return float(clean)
        except ValueError:
            return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def clean_rows(frame: pd.DataFrame, code_column: str) -> pd.DataFrame:
    frame = frame.rename(columns={code_column: "Food Code"}).copy()
    codes = frame["Food Code"].astype(str).str.strip()
    return frame[codes.str.match(r"^\d{2}-\d{3}$", na=False)]


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Pass the CoFID .xlsx path")

    source = Path(sys.argv[1])
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("lib/cofid.ts")

    prox = clean_rows(pd.read_excel(source, sheet_name="1.3 Proximates"), "Food Code")
    inorganic_raw = pd.read_excel(source, sheet_name="1.4 Inorganics")
    inorganic = clean_rows(inorganic_raw, inorganic_raw.columns[0])
    vitamins = clean_rows(pd.read_excel(source, sheet_name="1.5 Vitamins"), "Food Code")

    inorganics_by_code = inorganic.set_index("Food Code")
    vitamins_by_code = vitamins.set_index("Food Code")
    foods: list[dict[str, object]] = []

    for _, row in prox.iterrows():
        code = str(row["Food Code"]).strip()
        name = " ".join(str(row["Food Name"]).split())
        calories = number(row["Energy (kcal) (kcal)"])
        if not name or not calories:
            continue

        minerals = inorganics_by_code.loc[code] if code in inorganics_by_code.index else None
        vitamin_row = vitamins_by_code.loc[code] if code in vitamins_by_code.index else None
        fiber = number(row["AOAC fibre (g)"]) or number(row["NSP (g)"])

        foods.append(
            {
                "id": f"uk-{code}",
                "name": name,
                "calories": round(calories, 3),
                "protein": round(number(row["Protein (g)"]), 3),
                "carbs": round(number(row["Carbohydrate (g)"]), 3),
                "fat": round(number(row["Fat (g)"]), 3),
                "fiber": round(fiber, 3),
                "calcium": round(number(minerals["Calcium (mg)"]) if minerals is not None else 0, 3),
                "iron": round(number(minerals["Iron (mg)"]) if minerals is not None else 0, 3),
                "vitaminC": round(number(vitamin_row["Vitamin C (mg)"]) if vitamin_row is not None else 0, 3),
            }
        )

    rows = ",\n".join(json.dumps(food, ensure_ascii=False, separators=(",", ":")) for food in foods)
    content = (
        "import type { Nutrients } from './fit-types';\n\n"
        "export interface CofidFood extends Nutrients { id: string; name: string; }\n\n"
        "// Valores por 100 g. Fonte: UK Composition of Foods Integrated Dataset (CoFID) 2021.\n"
        "// https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid\n"
        f"export const cofidFoods: CofidFood[] = [\n{rows}\n];\n"
    )
    output.write_text(content, encoding="utf-8")
    print(f"Wrote {len(foods)} foods to {output}")


if __name__ == "__main__":
    main()
