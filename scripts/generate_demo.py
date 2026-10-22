"""Generate reproducible synthetic data; no network or external libraries required."""

import csv
import math
import random
from pathlib import Path


def generate(destination: Path) -> None:
    rng = random.Random(42)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(
            ["tenure_months", "monthly_charges", "support_calls", "contract", "internet", "churn"]
        )
        for index in range(320):
            tenure = rng.randint(1, 72)
            charges = round(rng.uniform(20, 120), 2)
            calls = rng.randint(0, 7)
            contract = rng.choice(["monthly", "annual", "two_year"])
            internet = rng.choice(["fiber", "dsl", "none"])
            score = -1.9 + 0.025 * charges - 0.035 * tenure + 0.38 * calls
            score += 0.8 if contract == "monthly" else -0.9
            churn = int(rng.random() < 1 / (1 + math.exp(-score)))
            writer.writerow(
                [
                    tenure,
                    "" if index % 29 == 0 else charges,
                    calls,
                    "" if index % 43 == 0 else contract,
                    internet,
                    churn,
                ]
            )


if __name__ == "__main__":
    generate(Path(__file__).resolve().parents[1] / "data" / "demo_churn.csv")
