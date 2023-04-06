import secrets from "./secrets.json" assert { type: "json" };
import { format, parse } from "https://deno.land/std@0.182.0/datetime/mod.ts";

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

interface BankResponse {
  accountStatement: {
    info: {
      accountId: string;
      bankId: string;
      currency: string;
      iban: string;
      bic: string;
      openingBalance: number;
      closingBalance: number;
      dateStart: string;
      dateEnd: string;
    };
    transactionList: {
      transaction: BankTransaction[];
    };
  };
}

enum Col {
  transactionId = "column22",
  date = "column0",
  amount = "column1",
  currency = "column14",
  variableSymbol = "column5",

  counterAccount = "column2",
  counterBankCode = "column3",
  counterAccountName = "column10",
}

interface Transaction {
  transactionId: number;
  date: Date;
  amount: number;
  currency: string;
  variableSymbol: number;

  counterAccount: {
    account: string;
    name: string;
  };
}

type BankTransaction = {
  [k in Col]: {
    value: string | number;
    name: string;
    id: number;
  };
};

const fetchTransactions = async (retries = 5): Promise<Transaction[]> => {
  const from = "2023-01-01";
  const to = format(new Date(), "yyyy-MM-dd");
  const url = `https://www.fio.cz/ib_api/rest/periods/${secrets.bankToken}/${from}/${to}/transactions.json`;

  try {
    const res = await fetch(url);
    const body: BankResponse = await res.json();
    return body.accountStatement.transactionList.transaction.map((data) => ({
      transactionId: +data[Col.transactionId].value,
      date: parse(String(data[Col.date].value).slice(0, 10), "yyyy-MM-dd"),
      amount: +data[Col.amount].value,
      currency: "" + data[Col.currency].value,
      variableSymbol: +data[Col.variableSymbol]?.value,

      counterAccount: {
        account: `${data[Col.counterAccount].value}/${
          data[Col.counterBankCode].value
        }`,
        name: "" + data[Col.counterAccountName].value,
      },
    }));
  } catch (e) {
    if (retries <= 0) throw e;
    // wait for 1s, 2s, 3.5s, 10s, 50s before trying again
    // maximum wait time before failing is ~1 min
    await delay(50_000 / retries**1.5);
    return fetchTransactions(retries - 1);
  }
};