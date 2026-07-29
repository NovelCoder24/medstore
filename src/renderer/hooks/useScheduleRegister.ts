import { useQuery } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface ScheduleRegisterEntry {
  sale_date: string
  bill_number: string
  drug_name: string
  schedule_flag: string
  generic_name: string
  composition: string
  batch_number: string
  expiry_date: string
  qty_sold: number
  pack_size: number
  patient_name: string
  patient_phone: string
  doctor_name: string
  doctor_reg_no: string
  sold_by: string
}

export interface ScheduleRegisterResponse {
  data: ScheduleRegisterEntry[]
  csvContent: string
}

export function useScheduleRegister(startDate: string, endDate: string) {
  return useQuery<ScheduleRegisterResponse>({
    queryKey: ['reports', 'schedule-register', startDate, endDate],
    queryFn: async () => {
      return window.api.invoke(IPC_CHANNELS.REPORTS_SCHEDULE_REGISTER, startDate, endDate)
    },
    enabled: !!startDate && !!endDate
  })
}
