export default function AdminTable({ columns = [], children, minWidth = 960 }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" style={{ minWidth }}>
        {columns.length ? (
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
