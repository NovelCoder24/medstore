import React, { useState, useMemo } from 'react'
import { ClipboardList, Download, Printer } from 'lucide-react'
import { useScheduleRegister } from '../../hooks/useScheduleRegister'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'

export function ScheduleRegister() {
  const today = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const currentMonthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`
  const currentDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const [startDate, setStartDate] = useState(currentMonthStart)
  const [endDate, setEndDate] = useState(currentDate)
  const [scheduleFilter, setScheduleFilter] = useState('ALL')

  const { data, isLoading } = useScheduleRegister(startDate, endDate)

  const filteredData = useMemo(() => {
    if (!data?.data) return []
    if (scheduleFilter === 'ALL') return data.data
    return data.data.filter(item => item.schedule_flag === scheduleFilter)
  }, [data, scheduleFilter])

  const handleExportCSV = () => {
    if (!data?.csvContent) return
    const blob = new Blob([data.csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Schedule_Register_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrintPDF = async () => {
    if (!filteredData.length) return
    const printHtml = generatePrintHtml()
    try {
      await window.api.invoke(IPC_CHANNELS.PRINT_PDF, printHtml, `Schedule_Register_${startDate}_to_${endDate}.pdf`, {
        landscape: true,
        margins: { marginType: 'minimum' }
      })
      // Open path would usually be handled here or inside print service
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    }
  }

  const generatePrintHtml = () => {
    const rowsHtml = filteredData.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.sale_date.split('T')[0]}</td>
        <td>${r.bill_number}</td>
        <td>${r.schedule_flag}</td>
        <td>${r.drug_name}</td>
        <td>${r.batch_number}</td>
        <td>${r.expiry_date}</td>
        <td>${r.pack_size > 1 ? `${r.qty_sold} (${Math.floor(r.qty_sold / r.pack_size)}x${r.pack_size})` : r.qty_sold}</td>
        <td>${r.patient_name}</td>
        <td>${r.doctor_name}</td>
        <td>${r.doctor_reg_no}</td>
      </tr>
    `).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: sans-serif; font-size: 10px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 18px; margin: 0 0 5px 0; }
          .header p { margin: 0; color: #555; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #ccc; padding: 4px; text-align: left; word-wrap: break-word; }
          th { background: #f3f4f6; font-weight: bold; }
          /* Proportional Column Widths */
          th:nth-child(1) { width: 4%; }  /* S.No */
          th:nth-child(2) { width: 8%; }  /* Date */
          th:nth-child(3) { width: 8%; }  /* Bill No */
          th:nth-child(4) { width: 5%; }  /* Sch */
          th:nth-child(5) { width: 15%; } /* Drug */
          th:nth-child(6) { width: 10%; } /* Batch */
          th:nth-child(7) { width: 7%; }  /* Expiry */
          th:nth-child(8) { width: 8%; }  /* Qty */
          th:nth-child(9) { width: 12%; } /* Patient */
          th:nth-child(10) { width: 12%; }/* Doctor */
          th:nth-child(11) { width: 11%; }/* Reg No */
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Pharmacy</h1>
          <p>Schedule H/H1/X Drug Register</p>
          <p>From: ${startDate} To: ${endDate}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Date</th>
              <th>Bill No</th>
              <th>Sch</th>
              <th>Drug Name</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th>Qty</th>
              <th>Patient</th>
              <th>Doctor Name</th>
              <th>Reg No</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `
  }

  const hCount = filteredData.filter(d => d.schedule_flag === 'H').length
  const h1Count = filteredData.filter(d => d.schedule_flag === 'H1').length
  const xCount = filteredData.filter(d => d.schedule_flag === 'X').length

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            Schedule H/H1/X Drug Register
          </h1>
          <p className="text-sm text-gray-500 mt-1">As required under Rule 65, Drugs and Cosmetics Rules</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
            <span className="text-gray-500">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
          </div>

          <select 
            value={scheduleFilter} 
            onChange={e => setScheduleFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="ALL">All Schedules</option>
            <option value="H">Schedule H</option>
            <option value="H1">Schedule H1</option>
            <option value="X">Schedule X</option>
          </select>

          <div className="flex gap-2 ml-4">
            <button 
              onClick={handleExportCSV}
              disabled={!filteredData.length}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button 
              onClick={handlePrintPDF}
              disabled={!filteredData.length}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border rounded-lg shadow-sm">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading register data...</div>
          ) : filteredData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No Schedule H/H1/X drug sales found for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3">S.No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Bill No</th>
                    <th className="px-4 py-3">Sch</th>
                    <th className="px-4 py-3">Drug Name</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Doctor</th>
                    <th className="px-4 py-3">Reg No</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{item.sale_date.split('T')[0]}</td>
                      <td className="px-4 py-3 font-medium">{item.bill_number}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-semibold">
                          {item.schedule_flag}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.drug_name}</div>
                        {item.composition && <div className="text-xs text-gray-500 truncate max-w-[200px]" title={item.composition}>{item.composition}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.batch_number}</div>
                        <div className="text-xs text-gray-500">Exp: {item.expiry_date}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.pack_size > 1 ? `${item.qty_sold} (${Math.floor(item.qty_sold / item.pack_size)}x${item.pack_size})` : item.qty_sold}
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.patient_name}</div>
                        {item.patient_phone && <div className="text-xs text-gray-500">{item.patient_phone}</div>}
                      </td>
                      <td className="px-4 py-3">{item.doctor_name}</td>
                      <td className="px-4 py-3 text-gray-500">{item.doctor_reg_no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-t px-6 py-3 flex justify-between items-center text-sm text-gray-600">
        <div>Total Entries: <span className="font-semibold text-gray-900">{filteredData.length}</span></div>
        <div className="flex gap-4">
          <div>H: <span className="font-semibold text-gray-900">{hCount}</span></div>
          <div>H1: <span className="font-semibold text-gray-900">{h1Count}</span></div>
          <div>X: <span className="font-semibold text-gray-900">{xCount}</span></div>
        </div>
      </div>
    </div>
  )
}
