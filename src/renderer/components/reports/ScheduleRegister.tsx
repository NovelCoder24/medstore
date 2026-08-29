import React, { useState, useMemo } from 'react'
import { ClipboardList, Download, Printer, ShieldAlert, FileText, Calendar, Filter, Loader2 } from 'lucide-react'
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
    let storeName = 'Pharmacy'
    try {
      const settings = await window.api.invoke(IPC_CHANNELS.SETTINGS_GET)
      if (settings?.storeName) storeName = settings.storeName
    } catch (e) {
      console.warn('Failed to fetch settings for print header')
    }

    const printHtml = generatePrintHtml(storeName)
    try {
      await window.api.invoke(IPC_CHANNELS.PRINT_PDF, printHtml, `Schedule_Register_${startDate}_to_${endDate}.pdf`, {
        landscape: true,
        margins: { marginType: 'minimum' }
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    }
  }

  const generatePrintHtml = (storeName: string) => {
    const rowsHtml = filteredData.map((r, i) => {
      const qtySold = r.qty_sold || 0
      const packSize = r.pack_size && r.pack_size > 0 ? r.pack_size : 1
      const packs = Math.floor(qtySold / packSize)
      const loose = qtySold % packSize
      let qtyDisplay = `${qtySold}`
      if (packSize > 1) {
        if (loose > 0 && packs > 0) {
          qtyDisplay = `${qtySold} (${packs}x${packSize} + ${loose})`
        } else if (packs > 0) {
          qtyDisplay = `${qtySold} (${packs}x${packSize})`
        }
      }

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${r.sale_date ? r.sale_date.slice(0, 10) : '-'}</td>
          <td>${r.bill_number}</td>
          <td>${r.schedule_flag}</td>
          <td>${r.drug_name}</td>
          <td>${r.batch_number}</td>
          <td>${r.expiry_date}</td>
          <td>${qtyDisplay}</td>
          <td>${r.patient_name}</td>
          <td>${r.patient_address || ''}</td>
          <td>${r.doctor_name}</td>
          <td>${r.doctor_reg_no}</td>
        </tr>
      `
    }).join('')

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
          th:nth-child(1) { width: 3%; }  /* S.No */
          th:nth-child(2) { width: 8%; }  /* Date */
          th:nth-child(3) { width: 8%; }  /* Bill No */
          th:nth-child(4) { width: 4%; }  /* Sch */
          th:nth-child(5) { width: 14%; } /* Drug */
          th:nth-child(6) { width: 9%; }  /* Batch */
          th:nth-child(7) { width: 7%; }  /* Expiry */
          th:nth-child(8) { width: 7%; }  /* Qty */
          th:nth-child(9) { width: 10%; } /* Patient */
          th:nth-child(10) { width: 10%; }/* Address */
          th:nth-child(11) { width: 10%; }/* Doctor */
          th:nth-child(12) { width: 10%; }/* Reg No */
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${storeName}</h1>
          <p>Schedule H1/X Drug Register</p>
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
              <th>Address</th>
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

  const h1Count = filteredData.filter(d => d.schedule_flag === 'H1').length
  const xCount = filteredData.filter(d => d.schedule_flag === 'X').length

  return (
    <div className="space-y-6">
      {/* Compliance Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-500 text-white rounded tracking-wide">
              MANDATORY COMPLIANCE
            </span>
            <h2 className="text-xl font-bold tracking-tight">Schedule H / H1 & Narcotic Drug Register</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Official pharmaceutical audit trail for prescription-only and habit-forming drugs as required under Rule 65(3), Drugs & Cosmetics Act.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            disabled={!filteredData.length}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button 
            onClick={handlePrintPDF}
            disabled={!filteredData.length}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm shadow-blue-500/20 transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Export Regulatory PDF
          </button>
        </div>
      </div>

      {/* Filter Bar Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Date Range:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Schedule Filter:</span>
            <select 
              value={scheduleFilter} 
              onChange={e => setScheduleFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Schedules (H1 / X / H)</option>
              <option value="H1">Schedule H1 Only</option>
              <option value="X">Schedule X (Narcotics) Only</option>
              <option value="H">Schedule H</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          <div>Schedule H1: <span className="font-bold text-red-600">{h1Count}</span></div>
          <div>Schedule X: <span className="font-bold text-rose-700">{xCount}</span></div>
          <div className="pl-3 border-l border-slate-200">Total Records: <span className="font-bold text-slate-900">{filteredData.length}</span></div>
        </div>
      </div>

      {/* Regulatory Compliance Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Querying regulatory register...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-sm text-slate-700">No Scheduled Drug Dispensed</p>
            <p className="text-xs text-slate-400 mt-1">No Schedule H1, H, or X sales recorded in the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Bill No</th>
                  <th className="py-3 px-3">Schedule Tag</th>
                  <th className="py-3 px-3">Prescribed Drug</th>
                  <th className="py-3 px-3">Batch & Exp</th>
                  <th className="py-3 px-3 text-right">Qty Dispensed</th>
                  <th className="py-3 px-3">Patient Details</th>
                  <th className="py-3 px-3">Doctor & Reg #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredData.map((item, index) => {
                  const isSchX = item.schedule_flag === 'X'
                  const isSchH1 = item.schedule_flag === 'H1'
                  return (
                    <tr key={index} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-slate-500 font-mono">{item.sale_date ? item.sale_date.slice(0, 10) : '-'}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 font-mono">{item.bill_number}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isSchX 
                            ? 'bg-rose-100 text-rose-800 border-rose-300' 
                            : isSchH1 
                            ? 'bg-red-100 text-red-800 border-red-300' 
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          Schedule {item.schedule_flag}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.drug_name}</div>
                        {item.composition && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={item.composition}>
                            {item.composition}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="text-slate-800 font-semibold">{item.batch_number}</div>
                        <div className="text-[10px] text-slate-400">Exp: {item.expiry_date}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {(() => {
                          const qtySold = item.qty_sold || 0
                          const packSize = item.pack_size && item.pack_size > 0 ? item.pack_size : 1
                          const packs = Math.floor(qtySold / packSize)
                          const loose = qtySold % packSize
                          if (packSize > 1) {
                            if (loose > 0 && packs > 0) {
                              return `${qtySold} units (${packs}p + ${loose}u)`
                            } else if (packs > 0) {
                              return `${qtySold} units (${packs}p)`
                            }
                          }
                          return `${qtySold} units`
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.patient_name}</div>
                        <div className="text-[10px] text-slate-500">{item.patient_address || 'Address on file'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{item.doctor_name || 'Dr. Consulted'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.doctor_reg_no ? `Reg: ${item.doctor_reg_no}` : ''}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

