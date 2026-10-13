import { describe, expect, it } from "vitest";
import { detectFormat, parseCSV, parseOFX, parseOfxMeta } from "../src/domain/import";

describe("import detection", () => {
  it("detects CSV and OFX", () => {
    expect(detectFormat("data;valor;descrição\n01/03/2024;-10,50;Mercado")).toBe("csv");
    expect(detectFormat("<OFX><BANKTRANLIST><STMTTRN>...</STMTTRN>")).toBe("ofx");
  });
});

describe("parseCSV", () => {
  it("parses pt-BR header with ; delimiter", () => {
    const rows = parseCSV(
      "data;valor;descrição\n01/03/2024;-10,50;Mercado\n05/03/2024;1.500,00;Salário",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2024-03-01", amountCents: 1050, nature: "saida", description: "Mercado" });
    expect(rows[1]).toMatchObject({ date: "2024-03-05", amountCents: 150000, nature: "entrada" });
    expect(rows[0]?.externalRef).toMatch(/^csv-/);
  });

  it("parses comma delimiter with ISO dates and parentheses", () => {
    const rows = parseCSV("date,amount,memo\n2024-03-01,(25.00),Fee\n2024-03-02,30.00,Refund");
    expect(rows[0]).toMatchObject({ date: "2024-03-01", amountCents: 2500, nature: "saida" });
    expect(rows[1]).toMatchObject({ amountCents: 3000, nature: "entrada" });
  });

  it("flags invalid lines without stopping", () => {
    const rows = parseCSV("data;valor;descrição\n01/03/2024;-10,50;Ok\nxxx;yyy;Erro");
    expect(rows[0]?.error).toBeUndefined();
    expect(rows[1]?.error).toBe("Linha inválida");
  });
});

describe("parseOFX", () => {
  it("parses SGML transactions", () => {
    const ofx = `
      <OFX><BANKTRANLIST>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240301120000<TRNAMT>-10.50<FITID>abc123<MEMO>Mercado
      <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240305<TRNAMT>1500.00<FITID>def456<MEMO>Salario
      `;
    const rows = parseOFX(ofx);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2024-03-01", amountCents: 1050, nature: "saida", externalRef: "abc123" });
    expect(rows[1]).toMatchObject({ nature: "entrada", externalRef: "def456" });
  });
});

describe("parseOfxMeta", () => {
  it("extracts the ending balance and date from LEDGERBAL", () => {
    const ofx = `
      <BANKTRANLIST></BANKTRANLIST>
      <LEDGERBAL><BALAMT>667.17<DTASOF>20261008120000</LEDGERBAL>
    `;
    expect(parseOfxMeta(ofx)).toEqual({ balanceCents: 66717, balanceDate: "2026-10-08" });
  });

  it("returns nulls when there is no LEDGERBAL", () => {
    expect(parseOfxMeta("<OFX><BANKTRANLIST></BANKTRANLIST>")).toEqual({
      balanceCents: null,
      balanceDate: null,
    });
  });
});
