import test from "node:test";
import assert from "node:assert/strict";
import {
  splitSqlStatements,
  applyMigrationBatch,
} from "../scripts/sql-statements.mjs";
test("preserves SQL function bodies, literals, identifiers and nested comments", () => {
  const script = `-- semicolon ;\nCREATE FUNCTION example() RETURNS void AS $body$ BEGIN PERFORM ';'; PERFORM 2; END $body$ LANGUAGE plpgsql; /* outer ; /* inner ; */ end */ SELECT 'it''s; safe', "quoted;name", E'escaped\\';text'; SELECT 3;`;
  const parts = splitSqlStatements(script);
  assert.equal(parts.length, 3);
  assert.match(parts[0], /PERFORM 2; END \$body\$/);
  assert.match(parts[1], /inner ;/);
  assert.equal(parts[2], "SELECT 3");
  assert.deepEqual(splitSqlStatements("SELECT $1; SELECT $$a;b$$;"), [
    "SELECT $1",
    "SELECT $$a;b$$",
  ]);
  for (const s of ["SELECT 'bad", "SELECT $$bad", "/* unclosed"])
    assert.throws(() => splitSqlStatements(s));
});
test("prepares all statements before submitting one atomic batch", async () => {
  let calls = 0;
  const sql = {
    query: (statement, params) => ({ statement, params }),
    transaction: async (entries) => {
      calls++;
      assert.equal(entries.length, 2);
      assert.match(entries[0].statement, /BEGIN RETURN; END/);
    },
  };
  await applyMigrationBatch(sql, [
    "CREATE FUNCTION f() RETURNS void AS $$ BEGIN RETURN; END $$ LANGUAGE plpgsql;",
    "SELECT 1;",
  ]);
  assert.equal(calls, 1);
  await assert.rejects(applyMigrationBatch(sql, ["SELECT $$broken"]));
  assert.equal(calls, 1);
});
