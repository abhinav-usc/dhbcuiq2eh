import type { ReactNode } from 'react'

export interface Column<Row> {
  header: string
  align?: 'left' | 'right'
  render: (row: Row) => ReactNode
}

interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  maxHeight?: number
}

/** The table twin of a chart: every plotted value, readable without hovering. */
export function DataTable<Row>({ columns, rows, rowKey, maxHeight = 340 }: DataTableProps<Row>) {
  return (
    <div className="table-wrap" style={{ maxHeight }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={column.align === 'right' ? 'num' : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.header} className={column.align === 'right' ? 'num' : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
