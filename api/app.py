"""HxTradeHelper trade API - receives journal exports and stores them in MariaDB.

Run with:  uvicorn app:app --host 0.0.0.0 --port 8000
Configuration comes from environment variables, see README.md.
"""
import os
from datetime import datetime
from typing import List, Optional

import pymysql
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

DB_HOST = os.getenv("HX_DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("HX_DB_PORT", "3306"))
DB_USER = os.getenv("HX_DB_USER", "hx")
DB_PASSWORD = os.getenv("HX_DB_PASSWORD", "")
DB_NAME = os.getenv("HX_DB_NAME", "hx_trades")
API_KEY = os.getenv("HX_API_KEY", "")

app = FastAPI(title="HxTradeHelper Trade API")


class Trade(BaseModel):
    position_id: int
    symbol: str
    type: str
    result: str
    rr: Optional[str] = None
    entry_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    close_price: Optional[float] = None
    profit: float
    open_time: str
    close_time: Optional[str] = None
    is_open: bool = False


class TradeExport(BaseModel):
    account: int
    export_time: Optional[str] = None
    trades: List[Trade]


def connect():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        autocommit=True,
    )


def parse_time(value: Optional[str]) -> Optional[datetime]:
    """Parse the MT5 TimeToString format 'yyyy.mm.dd hh:mm:ss'."""
    if not value:
        return None
    return datetime.strptime(value, "%Y.%m.%d %H:%M:%S")


UPSERT = """
INSERT INTO trades (account, position_id, symbol, type, result, rr,
                    entry_price, stop_loss, take_profit, close_price,
                    profit, open_time, close_time, is_open)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
    symbol = VALUES(symbol),
    type = VALUES(type),
    result = VALUES(result),
    rr = VALUES(rr),
    entry_price = VALUES(entry_price),
    stop_loss = VALUES(stop_loss),
    take_profit = VALUES(take_profit),
    close_price = VALUES(close_price),
    profit = VALUES(profit),
    open_time = VALUES(open_time),
    close_time = VALUES(close_time),
    is_open = VALUES(is_open)
"""


@app.post("/api/trades")
def save_trades(payload: TradeExport, x_api_key: str = Header(default="")):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")

    conn = connect()
    try:
        with conn.cursor() as cur:
            for t in payload.trades:
                cur.execute(
                    UPSERT,
                    (
                        payload.account,
                        t.position_id,
                        t.symbol,
                        t.type,
                        t.result,
                        t.rr or None,
                        t.entry_price,
                        t.stop_loss or None,
                        t.take_profit or None,
                        t.close_price or None,
                        t.profit,
                        parse_time(t.open_time),
                        parse_time(t.close_time),
                        int(t.is_open),
                    ),
                )
    finally:
        conn.close()
    return {"saved": len(payload.trades)}


@app.get("/api/health")
def health():
    return {"status": "ok"}
