import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE_URL = "https://servicebus2.caixa.gov.br/portaldeloterias/api/federal"
OUTPUT = Path("data/federal.json")
QUANTIDADE = 15

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FederalIntelligence/1.0)",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://loterias.caixa.gov.br",
    "Referer": "https://loterias.caixa.gov.br/",
}

def fetch(session, url):
    response = session.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError("A CAIXA retornou um formato inesperado.")
    return data

def normalize(data):
    numero = int(data.get("numero") or 0)
    raw_date = str(data.get("dataApuracao") or "")
    try:
        date_obj = datetime.strptime(raw_date, "%d/%m/%Y")
    except ValueError as exc:
        raise ValueError(f"Data inválida no concurso {numero}: {raw_date}") from exc

    bilhetes = data.get("listaDezenas") or data.get("dezenasSorteadasOrdemSorteio") or []
    if numero <= 0 or len(bilhetes) < 5:
        raise ValueError(f"Resultado incompleto no concurso {numero}.")

    prizes = []
    for position, ticket in enumerate(bilhetes[:5], start=1):
        ticket = str(ticket).strip()
        if not ticket.isdigit() or len(ticket) not in (5, 6):
            raise ValueError(f"Bilhete inválido no concurso {numero}: {ticket}")
        prizes.append({"posicao": position, "bilhete": ticket.zfill(5)})

    return {
        "numero": numero,
        "data_concurso": date_obj.strftime("%Y-%m-%d"),
        "premios": prizes,
        "fonte": "CAIXA",
        "fonte_url": f"{BASE_URL}/{numero}",
    }

def main():
    session = requests.Session()
    latest = fetch(session, BASE_URL)
    latest_number = int(latest.get("numero") or 0)
    if latest_number <= 0:
        raise RuntimeError("Não foi possível identificar o último concurso publicado.")

    contests = []
    for number in range(latest_number, max(0, latest_number - QUANTIDADE), -1):
        try:
            raw = latest if number == latest_number else fetch(session, f"{BASE_URL}/{number}")
            contests.append(normalize(raw))
        except requests.HTTPError as exc:
            # Concurso ausente/indisponível não deve ser inventado nem substituído.
            print(f"Aviso: concurso {number} indisponível: {exc}")
        if number != latest_number:
            time.sleep(1.0)

    if not contests:
        raise RuntimeError("Nenhum concurso válido foi coletado.")
    contests.sort(key=lambda item: item["numero"], reverse=True)

    payload = {
        "fonte": "CAIXA Econômica Federal",
        "url_fonte": "https://loterias.caixa.gov.br/Paginas/Federal.aspx",
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
        "quantidade": len(contests),
        "concursos": contests,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Arquivo atualizado: {len(contests)} concursos; último #{contests[0]['numero']}.")

if __name__ == "__main__":
    main()
