import React from 'react'
import { Calendar, Clock } from 'lucide-react'

export type DateFilterPreset = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'

interface DateRangeFilterProps {
  preset: DateFilterPreset
  startDate: string
  endDate: string
  onChange: (preset: DateFilterPreset, startDate: string, endDate: string) => void
}

function getPresetDates(preset: DateFilterPreset): { startDate: string; endDate: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const todayStr = toDateStr(now)

  switch (preset) {
    case 'TODAY':
      return { startDate: todayStr, endDate: todayStr }

    case 'THIS_WEEK': {
      const day = now.getDay() // 0 is Sunday, 1 is Monday
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
      const monday = new Date(now)
      monday.setDate(diff)
      return { startDate: toDateStr(monday), endDate: todayStr }
    }

    case 'THIS_MONTH': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: toDateStr(firstDay), endDate: toDateStr(lastDay) }
    }

    case 'ALL':
    case 'CUSTOM':
    default:
      return { startDate: '', endDate: '' }
  }
}

export function DateRangeFilter({
  preset,
  startDate,
  endDate,
  onChange
}: DateRangeFilterProps) {
  const handlePresetClick = (nextPreset: DateFilterPreset) => {
    if (nextPreset === 'CUSTOM') {
      onChange('CUSTOM', startDate || getPresetDates('THIS_MONTH').startDate, endDate || getPresetDates('TODAY').endDate)
    } else if (nextPreset === 'ALL') {
      onChange('ALL', '', '')
    } else {
      const dates = getPresetDates(nextPreset)
      onChange(nextPreset, dates.startDate, dates.endDate)
    }
  }

  const presets: { key: DateFilterPreset; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'TODAY', label: 'Today' },
    { key: 'THIS_WEEK', label: 'This Week' },
    { key: 'THIS_MONTH', label: 'This Month' },
    { key: 'CUSTOM', label: 'Custom' }
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset Pill Buttons */}
      <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl shadow-xs">
        {presets.map((p) => {
          const isActive = preset === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePresetClick(p.key)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Custom Date Pickers */}
      {preset === 'CUSTOM' && (
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs shadow-xs animate-in fade-in">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange('CUSTOM', e.target.value, endDate)}
            className="outline-none bg-transparent text-slate-700 font-medium text-xs cursor-pointer"
            title="Start date"
          />
          <span className="text-slate-400 font-medium">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChange('CUSTOM', startDate, e.target.value)}
            className="outline-none bg-transparent text-slate-700 font-medium text-xs cursor-pointer"
            title="End date"
          />
        </div>
      )}
    </div>
  )
}
