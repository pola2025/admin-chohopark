import json
import sqlite3
import sys


def execute_batch(connection, statements):
    try:
        connection.execute("BEGIN")
        for statement in statements:
            connection.execute(statement["sql"], statement.get("params", []))
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def scalar(connection, sql, params=()):
    return connection.execute(sql, params).fetchone()[0]


def main():
    payload = json.load(sys.stdin)
    connection = sqlite3.connect(":memory:")
    connection.executescript(payload["schema"])
    connection.execute(
        "INSERT INTO meta_ads_sync(account_id,lease_owner,status) VALUES(?,?,?)",
        (payload["accountId"], payload["firstRunId"], "RUNNING"),
    )
    connection.commit()

    execute_batch(connection, payload["firstStatements"])
    first = {
        "rows": scalar(connection, "SELECT COUNT(*) FROM meta_ads_daily"),
        "spend": scalar(connection, "SELECT SUM(spend_micros) FROM meta_ads_daily"),
        "version": scalar(connection, "SELECT version FROM meta_ads_sync"),
    }

    connection.execute(
        "UPDATE meta_ads_sync SET lease_owner=?,status='RUNNING' WHERE account_id=?",
        (payload["secondRunId"], payload["accountId"]),
    )
    connection.commit()
    execute_batch(connection, payload["secondStatements"])
    second = {
        "rows": scalar(connection, "SELECT COUNT(*) FROM meta_ads_daily"),
        "spend": scalar(connection, "SELECT SUM(spend_micros) FROM meta_ads_daily"),
        "version": scalar(connection, "SELECT version FROM meta_ads_sync"),
    }

    before_rollback = connection.total_changes
    connection.execute(
        "UPDATE meta_ads_sync SET lease_owner='run-rollback',status='RUNNING' WHERE account_id=?",
        (payload["accountId"],),
    )
    connection.commit()
    try:
        execute_batch(connection, payload["rollbackStatements"])
    except sqlite3.DatabaseError:
        pass
    else:
        raise AssertionError("rollback fixture did not fail")
    after_rollback = {
        "rows": scalar(connection, "SELECT COUNT(*) FROM meta_ads_daily"),
        "spend": scalar(connection, "SELECT SUM(spend_micros) FROM meta_ads_daily"),
        "version": scalar(connection, "SELECT version FROM meta_ads_sync"),
        "totalChangesDelta": connection.total_changes - before_rollback,
    }

    connection.execute(
        "UPDATE meta_ads_sync SET lease_owner='actual-owner',status='RUNNING' WHERE account_id=?",
        (payload["accountId"],),
    )
    connection.commit()
    before_guard = connection.total_changes
    execute_batch(connection, payload["lostLeaseStatements"])
    lost_lease = {
        "rows": scalar(connection, "SELECT COUNT(*) FROM meta_ads_daily"),
        "spend": scalar(connection, "SELECT SUM(spend_micros) FROM meta_ads_daily"),
        "version": scalar(connection, "SELECT version FROM meta_ads_sync"),
        "totalChangesDelta": connection.total_changes - before_guard,
    }

    plans = []
    for query in payload["explain"]:
        detail = " | ".join(row[3] for row in connection.execute("EXPLAIN QUERY PLAN " + query["sql"], query.get("params", [])))
        plans.append(detail)

    print(json.dumps({"first": first, "second": second, "rollback": after_rollback, "lostLease": lost_lease, "plans": plans}))


if __name__ == "__main__":
    main()
