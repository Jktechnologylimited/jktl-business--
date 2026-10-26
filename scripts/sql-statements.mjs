/** Split PostgreSQL scripts without cutting quoted function bodies or comments. */
export function splitSqlStatements(source) {
  const statements = [];
  let start = 0,
    quote = null,
    dollar = null,
    comment = 0,
    line = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i],
      next = source[i + 1];
    if (line) {
      if (c === "\n") line = false;
      continue;
    }
    if (comment) {
      if (c === "/" && next === "*") {
        comment++;
        i++;
      } else if (c === "*" && next === "/") {
        comment--;
        i++;
      }
      continue;
    }
    if (dollar) {
      if (source.startsWith(dollar, i)) {
        i += dollar.length - 1;
        dollar = null;
      }
      continue;
    }
    if (quote) {
      if (quote === "escape" && c === "\\") {
        i++;
        continue;
      }
      const end = quote === "escape" ? "'" : quote;
      if (c === end) {
        if (next === end) i++;
        else quote = null;
      }
      continue;
    }
    if (c === "-" && next === "-") {
      line = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      comment = 1;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote =
        c === "'" &&
        /[eE]/.test(source[i - 1] || "") &&
        !/[\w$]/.test(source[i - 2] || "")
          ? "escape"
          : c;
      continue;
    }
    if (c === "$" && !/[\w$]/.test(source[i - 1] || "")) {
      const tag = /^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.exec(source.slice(i));
      if (tag) {
        dollar = tag[0];
        i += dollar.length - 1;
        continue;
      }
    }
    if (c === ";") {
      const statement = source.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  if (quote || dollar || comment)
    throw Error("Unterminated SQL quote or block comment");
  const tail = source.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

/** Neon executes each statement separately inside one atomic transaction. */
export async function applyMigrationBatch(sql, migrations) {
  const statements = migrations.flatMap(splitSqlStatements);
  await sql.transaction(
    statements.map((statement) => sql.query(statement, [])),
  );
}
