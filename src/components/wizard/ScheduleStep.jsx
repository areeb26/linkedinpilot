import React from 'react'
import { useWizard } from './WizardContext'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Calendar, Clock, ChevronLeft, Rocket, Save, Loader2, Search, Check, ChevronDown } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useCreateCampaign, useUpdateCampaign, useUploadLeads, useLaunchCampaign } from '@/hooks/useCampaigns'

// Helper to get today's date in yyyy-mm-dd format
const getTodayString = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// Helper to format date from yyyy-mm-dd to dd/mm/yyyy for display
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

// Helper to parse date from dd/mm/yyyy to yyyy-mm-dd
const parseDateInput = (inputStr) => {
  const parts = inputStr.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  // Validate
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null
  const date = new Date(`${year}-${month}-${day}`)
  if (isNaN(date.getTime())) return null
  return `${year}-${month}-${day}`
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC — Coordinated Universal Time' },
  // Africa
  { value: 'Africa/Abidjan', label: 'Africa/Abidjan (GMT+0)' },
  { value: 'Africa/Accra', label: 'Africa/Accra (GMT+0)' },
  { value: 'Africa/Addis_Ababa', label: 'Africa/Addis Ababa (EAT+3)' },
  { value: 'Africa/Algiers', label: 'Africa/Algiers (CET+1)' },
  { value: 'Africa/Asmara', label: 'Africa/Asmara (EAT+3)' },
  { value: 'Africa/Bamako', label: 'Africa/Bamako (GMT+0)' },
  { value: 'Africa/Bangui', label: 'Africa/Bangui (WAT+1)' },
  { value: 'Africa/Banjul', label: 'Africa/Banjul (GMT+0)' },
  { value: 'Africa/Bissau', label: 'Africa/Bissau (GMT+0)' },
  { value: 'Africa/Blantyre', label: 'Africa/Blantyre (CAT+2)' },
  { value: 'Africa/Brazzaville', label: 'Africa/Brazzaville (WAT+1)' },
  { value: 'Africa/Bujumbura', label: 'Africa/Bujumbura (CAT+2)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (EET+2)' },
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca (WET+0)' },
  { value: 'Africa/Ceuta', label: 'Africa/Ceuta (CET+1)' },
  { value: 'Africa/Conakry', label: 'Africa/Conakry (GMT+0)' },
  { value: 'Africa/Dakar', label: 'Africa/Dakar (GMT+0)' },
  { value: 'Africa/Dar_es_Salaam', label: 'Africa/Dar es Salaam (EAT+3)' },
  { value: 'Africa/Djibouti', label: 'Africa/Djibouti (EAT+3)' },
  { value: 'Africa/Douala', label: 'Africa/Douala (WAT+1)' },
  { value: 'Africa/El_Aaiun', label: 'Africa/El Aaiun (WET+0)' },
  { value: 'Africa/Freetown', label: 'Africa/Freetown (GMT+0)' },
  { value: 'Africa/Gaborone', label: 'Africa/Gaborone (CAT+2)' },
  { value: 'Africa/Harare', label: 'Africa/Harare (CAT+2)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST+2)' },
  { value: 'Africa/Juba', label: 'Africa/Juba (EAT+3)' },
  { value: 'Africa/Kampala', label: 'Africa/Kampala (EAT+3)' },
  { value: 'Africa/Khartoum', label: 'Africa/Khartoum (CAT+2)' },
  { value: 'Africa/Kigali', label: 'Africa/Kigali (CAT+2)' },
  { value: 'Africa/Kinshasa', label: 'Africa/Kinshasa (WAT+1)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT+1)' },
  { value: 'Africa/Libreville', label: 'Africa/Libreville (WAT+1)' },
  { value: 'Africa/Lome', label: 'Africa/Lome (GMT+0)' },
  { value: 'Africa/Luanda', label: 'Africa/Luanda (WAT+1)' },
  { value: 'Africa/Lubumbashi', label: 'Africa/Lubumbashi (CAT+2)' },
  { value: 'Africa/Lusaka', label: 'Africa/Lusaka (CAT+2)' },
  { value: 'Africa/Malabo', label: 'Africa/Malabo (WAT+1)' },
  { value: 'Africa/Maputo', label: 'Africa/Maputo (CAT+2)' },
  { value: 'Africa/Maseru', label: 'Africa/Maseru (SAST+2)' },
  { value: 'Africa/Mbabane', label: 'Africa/Mbabane (SAST+2)' },
  { value: 'Africa/Mogadishu', label: 'Africa/Mogadishu (EAT+3)' },
  { value: 'Africa/Monrovia', label: 'Africa/Monrovia (GMT+0)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT+3)' },
  { value: 'Africa/Ndjamena', label: 'Africa/Ndjamena (WAT+1)' },
  { value: 'Africa/Niamey', label: 'Africa/Niamey (WAT+1)' },
  { value: 'Africa/Nouakchott', label: 'Africa/Nouakchott (GMT+0)' },
  { value: 'Africa/Ouagadougou', label: 'Africa/Ouagadougou (GMT+0)' },
  { value: 'Africa/Porto-Novo', label: 'Africa/Porto-Novo (WAT+1)' },
  { value: 'Africa/Sao_Tome', label: 'Africa/Sao Tome (GMT+0)' },
  { value: 'Africa/Tripoli', label: 'Africa/Tripoli (EET+2)' },
  { value: 'Africa/Tunis', label: 'Africa/Tunis (CET+1)' },
  { value: 'Africa/Windhoek', label: 'Africa/Windhoek (WAT+1)' },
  // America
  { value: 'America/Adak', label: 'America/Adak (HAST-10)' },
  { value: 'America/Anchorage', label: 'America/Anchorage (AKST-9)' },
  { value: 'America/Anguilla', label: 'America/Anguilla (AST-4)' },
  { value: 'America/Antigua', label: 'America/Antigua (AST-4)' },
  { value: 'America/Araguaina', label: 'America/Araguaina (BRT-3)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'America/Argentina/Buenos Aires (ART-3)' },
  { value: 'America/Argentina/Catamarca', label: 'America/Argentina/Catamarca (ART-3)' },
  { value: 'America/Argentina/Cordoba', label: 'America/Argentina/Cordoba (ART-3)' },
  { value: 'America/Argentina/Jujuy', label: 'America/Argentina/Jujuy (ART-3)' },
  { value: 'America/Argentina/La_Rioja', label: 'America/Argentina/La Rioja (ART-3)' },
  { value: 'America/Argentina/Mendoza', label: 'America/Argentina/Mendoza (ART-3)' },
  { value: 'America/Argentina/Rio_Gallegos', label: 'America/Argentina/Rio Gallegos (ART-3)' },
  { value: 'America/Argentina/Salta', label: 'America/Argentina/Salta (ART-3)' },
  { value: 'America/Argentina/San_Juan', label: 'America/Argentina/San Juan (ART-3)' },
  { value: 'America/Argentina/San_Luis', label: 'America/Argentina/San Luis (ART-3)' },
  { value: 'America/Argentina/Tucuman', label: 'America/Argentina/Tucuman (ART-3)' },
  { value: 'America/Argentina/Ushuaia', label: 'America/Argentina/Ushuaia (ART-3)' },
  { value: 'America/Aruba', label: 'America/Aruba (AST-4)' },
  { value: 'America/Asuncion', label: 'America/Asuncion (PYT-4)' },
  { value: 'America/Atikokan', label: 'America/Atikokan (EST-5)' },
  { value: 'America/Bahia', label: 'America/Bahia (BRT-3)' },
  { value: 'America/Bahia_Banderas', label: 'America/Bahia Banderas (CST-6)' },
  { value: 'America/Barbados', label: 'America/Barbados (AST-4)' },
  { value: 'America/Belem', label: 'America/Belem (BRT-3)' },
  { value: 'America/Belize', label: 'America/Belize (CST-6)' },
  { value: 'America/Blanc-Sablon', label: 'America/Blanc-Sablon (AST-4)' },
  { value: 'America/Boa_Vista', label: 'America/Boa Vista (AMT-4)' },
  { value: 'America/Bogota', label: 'America/Bogota (COT-5)' },
  { value: 'America/Boise', label: 'America/Boise (MST-7)' },
  { value: 'America/Cambridge_Bay', label: 'America/Cambridge Bay (MST-7)' },
  { value: 'America/Campo_Grande', label: 'America/Campo Grande (AMT-4)' },
  { value: 'America/Cancun', label: 'America/Cancun (EST-5)' },
  { value: 'America/Caracas', label: 'America/Caracas (VET-4)' },
  { value: 'America/Cayenne', label: 'America/Cayenne (GFT-3)' },
  { value: 'America/Cayman', label: 'America/Cayman (EST-5)' },
  { value: 'America/Chicago', label: 'America/Chicago — Central Time (CT-6)' },
  { value: 'America/Chihuahua', label: 'America/Chihuahua (MST-7)' },
  { value: 'America/Costa_Rica', label: 'America/Costa Rica (CST-6)' },
  { value: 'America/Creston', label: 'America/Creston (MST-7)' },
  { value: 'America/Cuiaba', label: 'America/Cuiaba (AMT-4)' },
  { value: 'America/Curacao', label: 'America/Curacao (AST-4)' },
  { value: 'America/Danmarkshavn', label: 'America/Danmarkshavn (GMT+0)' },
  { value: 'America/Dawson', label: 'America/Dawson (PST-8)' },
  { value: 'America/Dawson_Creek', label: 'America/Dawson Creek (MST-7)' },
  { value: 'America/Denver', label: 'America/Denver — Mountain Time (MT-7)' },
  { value: 'America/Detroit', label: 'America/Detroit (EST-5)' },
  { value: 'America/Dominica', label: 'America/Dominica (AST-4)' },
  { value: 'America/Edmonton', label: 'America/Edmonton (MST-7)' },
  { value: 'America/Eirunepe', label: 'America/Eirunepe (AMT-4)' },
  { value: 'America/El_Salvador', label: 'America/El Salvador (CST-6)' },
  { value: 'America/Fortaleza', label: 'America/Fortaleza (BRT-3)' },
  { value: 'America/Glace_Bay', label: 'America/Glace Bay (AST-4)' },
  { value: 'America/Godthab', label: 'America/Godthab (WGT-3)' },
  { value: 'America/Goose_Bay', label: 'America/Goose Bay (AST-4)' },
  { value: 'America/Grand_Turk', label: 'America/Grand Turk (EST-5)' },
  { value: 'America/Grenada', label: 'America/Grenada (AST-4)' },
  { value: 'America/Guadeloupe', label: 'America/Guadeloupe (AST-4)' },
  { value: 'America/Guatemala', label: 'America/Guatemala (CST-6)' },
  { value: 'America/Guayaquil', label: 'America/Guayaquil (ECT-5)' },
  { value: 'America/Guyana', label: 'America/Guyana (GYT-4)' },
  { value: 'America/Halifax', label: 'America/Halifax (AST-4)' },
  { value: 'America/Havana', label: 'America/Havana (CST-5)' },
  { value: 'America/Hermosillo', label: 'America/Hermosillo (MST-7)' },
  { value: 'America/Indiana/Indianapolis', label: 'America/Indiana/Indianapolis (EST-5)' },
  { value: 'America/Indiana/Knox', label: 'America/Indiana/Knox (CST-6)' },
  { value: 'America/Indiana/Marengo', label: 'America/Indiana/Marengo (EST-5)' },
  { value: 'America/Indiana/Petersburg', label: 'America/Indiana/Petersburg (EST-5)' },
  { value: 'America/Indiana/Tell_City', label: 'America/Indiana/Tell City (CST-6)' },
  { value: 'America/Indiana/Vevay', label: 'America/Indiana/Vevay (EST-5)' },
  { value: 'America/Indiana/Vincennes', label: 'America/Indiana/Vincennes (EST-5)' },
  { value: 'America/Indiana/Winamac', label: 'America/Indiana/Winamac (EST-5)' },
  { value: 'America/Inuvik', label: 'America/Inuvik (MST-7)' },
  { value: 'America/Iqaluit', label: 'America/Iqaluit (EST-5)' },
  { value: 'America/Jamaica', label: 'America/Jamaica (EST-5)' },
  { value: 'America/Juneau', label: 'America/Juneau (AKST-9)' },
  { value: 'America/Kentucky/Louisville', label: 'America/Kentucky/Louisville (EST-5)' },
  { value: 'America/Kentucky/Monticello', label: 'America/Kentucky/Monticello (EST-5)' },
  { value: 'America/Kralendijk', label: 'America/Kralendijk (AST-4)' },
  { value: 'America/La_Paz', label: 'America/La Paz (BOT-4)' },
  { value: 'America/Lima', label: 'America/Lima (PET-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles — Pacific Time (PT-8)' },
  { value: 'America/Lower_Princes', label: 'America/Lower Princes (AST-4)' },
  { value: 'America/Maceio', label: 'America/Maceio (BRT-3)' },
  { value: 'America/Managua', label: 'America/Managua (CST-6)' },
  { value: 'America/Manaus', label: 'America/Manaus (AMT-4)' },
  { value: 'America/Marigot', label: 'America/Marigot (AST-4)' },
  { value: 'America/Martinique', label: 'America/Martinique (AST-4)' },
  { value: 'America/Matamoros', label: 'America/Matamoros (CST-6)' },
  { value: 'America/Mazatlan', label: 'America/Mazatlan (MST-7)' },
  { value: 'America/Menominee', label: 'America/Menominee (CST-6)' },
  { value: 'America/Merida', label: 'America/Merida (CST-6)' },
  { value: 'America/Metlakatla', label: 'America/Metlakatla (AKST-9)' },
  { value: 'America/Mexico_City', label: 'America/Mexico City (CST-6)' },
  { value: 'America/Miquelon', label: 'America/Miquelon (PMST-3)' },
  { value: 'America/Moncton', label: 'America/Moncton (AST-4)' },
  { value: 'America/Monterrey', label: 'America/Monterrey (CST-6)' },
  { value: 'America/Montevideo', label: 'America/Montevideo (UYT-3)' },
  { value: 'America/Montserrat', label: 'America/Montserrat (AST-4)' },
  { value: 'America/Nassau', label: 'America/Nassau (EST-5)' },
  { value: 'America/New_York', label: 'America/New York — Eastern Time (ET-5)' },
  { value: 'America/Nipigon', label: 'America/Nipigon (EST-5)' },
  { value: 'America/Nome', label: 'America/Nome (AKST-9)' },
  { value: 'America/Noronha', label: 'America/Noronha (FNT-2)' },
  { value: 'America/North_Dakota/Beulah', label: 'America/North Dakota/Beulah (CST-6)' },
  { value: 'America/North_Dakota/Center', label: 'America/North Dakota/Center (CST-6)' },
  { value: 'America/North_Dakota/New_Salem', label: 'America/North Dakota/New Salem (CST-6)' },
  { value: 'America/Ojinaga', label: 'America/Ojinaga (MST-7)' },
  { value: 'America/Panama', label: 'America/Panama (EST-5)' },
  { value: 'America/Pangnirtung', label: 'America/Pangnirtung (EST-5)' },
  { value: 'America/Paramaribo', label: 'America/Paramaribo (SRT-3)' },
  { value: 'America/Phoenix', label: 'America/Phoenix (MST-7)' },
  { value: 'America/Port-au-Prince', label: 'America/Port-au-Prince (EST-5)' },
  { value: 'America/Port_of_Spain', label: 'America/Port of Spain (AST-4)' },
  { value: 'America/Porto_Velho', label: 'America/Porto Velho (AMT-4)' },
  { value: 'America/Puerto_Rico', label: 'America/Puerto Rico (AST-4)' },
  { value: 'America/Rainy_River', label: 'America/Rainy River (CST-6)' },
  { value: 'America/Rankin_Inlet', label: 'America/Rankin Inlet (CST-6)' },
  { value: 'America/Recife', label: 'America/Recife (BRT-3)' },
  { value: 'America/Regina', label: 'America/Regina (CST-6)' },
  { value: 'America/Resolute', label: 'America/Resolute (CST-6)' },
  { value: 'America/Rio_Branco', label: 'America/Rio Branco (AMT-4)' },
  { value: 'America/Santa_Isabel', label: 'America/Santa Isabel (PST-8)' },
  { value: 'America/Santarem', label: 'America/Santarem (BRT-3)' },
  { value: 'America/Santiago', label: 'America/Santiago (CLT-4)' },
  { value: 'America/Santo_Domingo', label: 'America/Santo Domingo (AST-4)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao Paulo (BRT-3)' },
  { value: 'America/Scoresbysund', label: 'America/Scoresbysund (EGT-1)' },
  { value: 'America/Sitka', label: 'America/Sitka (AKST-9)' },
  { value: 'America/St_Barthelemy', label: 'America/St Barthelemy (AST-4)' },
  { value: 'America/St_Johns', label: 'America/St Johns (NST-3:30)' },
  { value: 'America/St_Kitts', label: 'America/St Kitts (AST-4)' },
  { value: 'America/St_Lucia', label: 'America/St Lucia (AST-4)' },
  { value: 'America/St_Thomas', label: 'America/St Thomas (AST-4)' },
  { value: 'America/St_Vincent', label: 'America/St Vincent (AST-4)' },
  { value: 'America/Swift_Current', label: 'America/Swift Current (CST-6)' },
  { value: 'America/Tegucigalpa', label: 'America/Tegucigalpa (CST-6)' },
  { value: 'America/Thule', label: 'America/Thule (AST-4)' },
  { value: 'America/Thunder_Bay', label: 'America/Thunder Bay (EST-5)' },
  { value: 'America/Tijuana', label: 'America/Tijuana (PST-8)' },
  { value: 'America/Toronto', label: 'America/Toronto (EST-5)' },
  { value: 'America/Tortola', label: 'America/Tortola (AST-4)' },
  { value: 'America/Vancouver', label: 'America/Vancouver (PST-8)' },
  { value: 'America/Whitehorse', label: 'America/Whitehorse (PST-8)' },
  { value: 'America/Winnipeg', label: 'America/Winnipeg (CST-6)' },
  { value: 'America/Yakutat', label: 'America/Yakutat (AKST-9)' },
  { value: 'America/Yellowknife', label: 'America/Yellowknife (MST-7)' },
  // Antarctica
  { value: 'Antarctica/Casey', label: 'Antarctica/Casey (WST+8)' },
  { value: 'Antarctica/Davis', label: 'Antarctica/Davis (DAVT+7)' },
  { value: 'Antarctica/DumontDUrville', label: 'Antarctica/DumontDUrville (DDUT+10)' },
  { value: 'Antarctica/Macquarie', label: 'Antarctica/Macquarie (MIST+11)' },
  { value: 'Antarctica/Mawson', label: 'Antarctica/Mawson (MAWT+5)' },
  { value: 'Antarctica/McMurdo', label: 'Antarctica/McMurdo (NZST+12)' },
  { value: 'Antarctica/Palmer', label: 'Antarctica/Palmer (CLT-4)' },
  { value: 'Antarctica/Rothera', label: 'Antarctica/Rothera (ROTT-3)' },
  { value: 'Antarctica/Syowa', label: 'Antarctica/Syowa (SYOT+3)' },
  { value: 'Antarctica/Troll', label: 'Antarctica/Troll (UTC+0)' },
  { value: 'Antarctica/Vostok', label: 'Antarctica/Vostok (VOST+6)' },
  // Arctic
  { value: 'Arctic/Longyearbyen', label: 'Arctic/Longyearbyen (CET+1)' },
  // Asia
  { value: 'Asia/Aden', label: 'Asia/Aden (AST+3)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (ALMT+6)' },
  { value: 'Asia/Amman', label: 'Asia/Amman (EET+2)' },
  { value: 'Asia/Anadyr', label: 'Asia/Anadyr (ANAT+12)' },
  { value: 'Asia/Aqtau', label: 'Asia/Aqtau (AQTT+5)' },
  { value: 'Asia/Aqtobe', label: 'Asia/Aqtobe (AQTT+5)' },
  { value: 'Asia/Ashgabat', label: 'Asia/Ashgabat (TMT+5)' },
  { value: 'Asia/Baghdad', label: 'Asia/Baghdad (AST+3)' },
  { value: 'Asia/Bahrain', label: 'Asia/Bahrain (AST+3)' },
  { value: 'Asia/Baku', label: 'Asia/Baku (AZT+4)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT+7)' },
  { value: 'Asia/Beirut', label: 'Asia/Beirut (EET+2)' },
  { value: 'Asia/Bishkek', label: 'Asia/Bishkek (KGT+6)' },
  { value: 'Asia/Brunei', label: 'Asia/Brunei (BNT+8)' },
  { value: 'Asia/Choibalsan', label: 'Asia/Choibalsan (CHOT+8)' },
  { value: 'Asia/Chongqing', label: 'Asia/Chongqing (CST+8)' },
  { value: 'Asia/Colombo', label: 'Asia/Colombo (IST+5:30)' },
  { value: 'Asia/Damascus', label: 'Asia/Damascus (EET+2)' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (BDT+6)' },
  { value: 'Asia/Dili', label: 'Asia/Dili (TLT+9)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST+4)' },
  { value: 'Asia/Dushanbe', label: 'Asia/Dushanbe (TJT+5)' },
  { value: 'Asia/Gaza', label: 'Asia/Gaza (EET+2)' },
  { value: 'Asia/Harbin', label: 'Asia/Harbin (CST+8)' },
  { value: 'Asia/Hebron', label: 'Asia/Hebron (EET+2)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho Chi Minh (ICT+7)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (HKT+8)' },
  { value: 'Asia/Hovd', label: 'Asia/Hovd (HOVT+7)' },
  { value: 'Asia/Irkutsk', label: 'Asia/Irkutsk (IRKT+8)' },
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB+7)' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura (WIT+9)' },
  { value: 'Asia/Kabul', label: 'Asia/Kabul (AFT+4:30)' },
  { value: 'Asia/Kamchatka', label: 'Asia/Kamchatka (PETT+12)' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi (PKT+5)' },
  { value: 'Asia/Kashgar', label: 'Asia/Kashgar (CST+8)' },
  { value: 'Asia/Kathmandu', label: 'Asia/Kathmandu (NPT+5:45)' },
  { value: 'Asia/Khandyga', label: 'Asia/Khandyga (YAKT+9)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST+5:30)' },
  { value: 'Asia/Krasnoyarsk', label: 'Asia/Krasnoyarsk (KRAT+7)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala Lumpur (MYT+8)' },
  { value: 'Asia/Kuching', label: 'Asia/Kuching (MYT+8)' },
  { value: 'Asia/Kuwait', label: 'Asia/Kuwait (AST+3)' },
  { value: 'Asia/Macau', label: 'Asia/Macau (CST+8)' },
  { value: 'Asia/Magadan', label: 'Asia/Magadan (MAGT+10)' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar (WITA+8)' },
  { value: 'Asia/Manila', label: 'Asia/Manila (PST+8)' },
  { value: 'Asia/Muscat', label: 'Asia/Muscat (GST+4)' },
  { value: 'Asia/Nicosia', label: 'Asia/Nicosia (EET+2)' },
  { value: 'Asia/Novokuznetsk', label: 'Asia/Novokuznetsk (KRAT+7)' },
  { value: 'Asia/Novosibirsk', label: 'Asia/Novosibirsk (NOVT+6)' },
  { value: 'Asia/Omsk', label: 'Asia/Omsk (OMST+6)' },
  { value: 'Asia/Oral', label: 'Asia/Oral (ORAT+5)' },
  { value: 'Asia/Phnom_Penh', label: 'Asia/Phnom Penh (ICT+7)' },
  { value: 'Asia/Pontianak', label: 'Asia/Pontianak (WIB+7)' },
  { value: 'Asia/Pyongyang', label: 'Asia/Pyongyang (KST+9)' },
  { value: 'Asia/Qatar', label: 'Asia/Qatar (AST+3)' },
  { value: 'Asia/Qyzylorda', label: 'Asia/Qyzylorda (QYZT+6)' },
  { value: 'Asia/Rangoon', label: 'Asia/Rangoon (MMT+6:30)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST+3)' },
  { value: 'Asia/Sakhalin', label: 'Asia/Sakhalin (SAKT+11)' },
  { value: 'Asia/Samarkand', label: 'Asia/Samarkand (UZT+5)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST+9)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST+8)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT+8)' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei (CST+8)' },
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent (UZT+5)' },
  { value: 'Asia/Tbilisi', label: 'Asia/Tbilisi (GET+4)' },
  { value: 'Asia/Tehran', label: 'Asia/Tehran (IRST+3:30)' },
  { value: 'Asia/Thimphu', label: 'Asia/Thimphu (BTT+6)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST+9)' },
  { value: 'Asia/Ulaanbaatar', label: 'Asia/Ulaanbaatar (ULAT+8)' },
  { value: 'Asia/Urumqi', label: 'Asia/Urumqi (CST+8)' },
  { value: 'Asia/Ust-Nera', label: 'Asia/Ust-Nera (VLAT+11)' },
  { value: 'Asia/Vientiane', label: 'Asia/Vientiane (ICT+7)' },
  { value: 'Asia/Vladivostok', label: 'Asia/Vladivostok (VLAT+10)' },
  { value: 'Asia/Yakutsk', label: 'Asia/Yakutsk (YAKT+9)' },
  { value: 'Asia/Yekaterinburg', label: 'Asia/Yekaterinburg (YEKT+5)' },
  { value: 'Asia/Yerevan', label: 'Asia/Yerevan (AMT+4)' },
  // Atlantic
  { value: 'Atlantic/Azores', label: 'Atlantic/Azores (AZOT-1)' },
  { value: 'Atlantic/Bermuda', label: 'Atlantic/Bermuda (AST-4)' },
  { value: 'Atlantic/Canary', label: 'Atlantic/Canary (WET+0)' },
  { value: 'Atlantic/Cape_Verde', label: 'Atlantic/Cape Verde (CVT-1)' },
  { value: 'Atlantic/Faroe', label: 'Atlantic/Faroe (WET+0)' },
  { value: 'Atlantic/Madeira', label: 'Atlantic/Madeira (WET+0)' },
  { value: 'Atlantic/Reykjavik', label: 'Atlantic/Reykjavik (GMT+0)' },
  { value: 'Atlantic/South_Georgia', label: 'Atlantic/South Georgia (GST-2)' },
  { value: 'Atlantic/St_Helena', label: 'Atlantic/St Helena (GMT+0)' },
  { value: 'Atlantic/Stanley', label: 'Atlantic/Stanley (FKST-3)' },
  // Australia
  { value: 'Australia/Adelaide', label: 'Australia/Adelaide (ACST+9:30)' },
  { value: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST+10)' },
  { value: 'Australia/Broken_Hill', label: 'Australia/Broken Hill (ACST+9:30)' },
  { value: 'Australia/Currie', label: 'Australia/Currie (AEST+10)' },
  { value: 'Australia/Darwin', label: 'Australia/Darwin (ACST+9:30)' },
  { value: 'Australia/Eucla', label: 'Australia/Eucla (ACWST+8:45)' },
  { value: 'Australia/Hobart', label: 'Australia/Hobart (AEST+10)' },
  { value: 'Australia/Lindeman', label: 'Australia/Lindeman (AEST+10)' },
  { value: 'Australia/Lord_Howe', label: 'Australia/Lord Howe (LHST+10:30)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST+10)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST+8)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST+10)' },
  // Europe
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET+1)' },
  { value: 'Europe/Andorra', label: 'Europe/Andorra (CET+1)' },
  { value: 'Europe/Athens', label: 'Europe/Athens (EET+2)' },
  { value: 'Europe/Belgrade', label: 'Europe/Belgrade (CET+1)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET+1)' },
  { value: 'Europe/Bratislava', label: 'Europe/Bratislava (CET+1)' },
  { value: 'Europe/Brussels', label: 'Europe/Brussels (CET+1)' },
  { value: 'Europe/Bucharest', label: 'Europe/Bucharest (EET+2)' },
  { value: 'Europe/Budapest', label: 'Europe/Budapest (CET+1)' },
  { value: 'Europe/Busingen', label: 'Europe/Busingen (CET+1)' },
  { value: 'Europe/Chisinau', label: 'Europe/Chisinau (EET+2)' },
  { value: 'Europe/Copenhagen', label: 'Europe/Copenhagen (CET+1)' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin (GMT+0)' },
  { value: 'Europe/Gibraltar', label: 'Europe/Gibraltar (CET+1)' },
  { value: 'Europe/Guernsey', label: 'Europe/Guernsey (GMT+0)' },
  { value: 'Europe/Helsinki', label: 'Europe/Helsinki (EET+2)' },
  { value: 'Europe/Isle_of_Man', label: 'Europe/Isle of Man (GMT+0)' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT+3)' },
  { value: 'Europe/Jersey', label: 'Europe/Jersey (GMT+0)' },
  { value: 'Europe/Kaliningrad', label: 'Europe/Kaliningrad (EET+2)' },
  { value: 'Europe/Kiev', label: 'Europe/Kiev (EET+2)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET+0)' },
  { value: 'Europe/Ljubljana', label: 'Europe/Ljubljana (CET+1)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
  { value: 'Europe/Luxembourg', label: 'Europe/Luxembourg (CET+1)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET+1)' },
  { value: 'Europe/Malta', label: 'Europe/Malta (CET+1)' },
  { value: 'Europe/Mariehamn', label: 'Europe/Mariehamn (EET+2)' },
  { value: 'Europe/Minsk', label: 'Europe/Minsk (FET+3)' },
  { value: 'Europe/Monaco', label: 'Europe/Monaco (CET+1)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK+3)' },
  { value: 'Europe/Nicosia', label: 'Europe/Nicosia (EET+2)' },
  { value: 'Europe/Oslo', label: 'Europe/Oslo (CET+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET+1)' },
  { value: 'Europe/Podgorica', label: 'Europe/Podgorica (CET+1)' },
  { value: 'Europe/Prague', label: 'Europe/Prague (CET+1)' },
  { value: 'Europe/Riga', label: 'Europe/Riga (EET+2)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (CET+1)' },
  { value: 'Europe/Samara', label: 'Europe/Samara (SAMT+4)' },
  { value: 'Europe/San_Marino', label: 'Europe/San Marino (CET+1)' },
  { value: 'Europe/Sarajevo', label: 'Europe/Sarajevo (CET+1)' },
  { value: 'Europe/Simferopol', label: 'Europe/Simferopol (MSK+3)' },
  { value: 'Europe/Skopje', label: 'Europe/Skopje (CET+1)' },
  { value: 'Europe/Sofia', label: 'Europe/Sofia (EET+2)' },
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm (CET+1)' },
  { value: 'Europe/Tallinn', label: 'Europe/Tallinn (EET+2)' },
  { value: 'Europe/Tirane', label: 'Europe/Tirane (CET+1)' },
  { value: 'Europe/Uzhgorod', label: 'Europe/Uzhgorod (EET+2)' },
  { value: 'Europe/Vaduz', label: 'Europe/Vaduz (CET+1)' },
  { value: 'Europe/Vatican', label: 'Europe/Vatican (CET+1)' },
  { value: 'Europe/Vienna', label: 'Europe/Vienna (CET+1)' },
  { value: 'Europe/Vilnius', label: 'Europe/Vilnius (EET+2)' },
  { value: 'Europe/Volgograd', label: 'Europe/Volgograd (MSK+3)' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw (CET+1)' },
  { value: 'Europe/Zagreb', label: 'Europe/Zagreb (CET+1)' },
  { value: 'Europe/Zaporozhye', label: 'Europe/Zaporozhye (EET+2)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET+1)' },
  // Indian Ocean
  { value: 'Indian/Antananarivo', label: 'Indian/Antananarivo (EAT+3)' },
  { value: 'Indian/Chagos', label: 'Indian/Chagos (IOT+6)' },
  { value: 'Indian/Christmas', label: 'Indian/Christmas (CXT+7)' },
  { value: 'Indian/Cocos', label: 'Indian/Cocos (CCT+6:30)' },
  { value: 'Indian/Comoro', label: 'Indian/Comoro (EAT+3)' },
  { value: 'Indian/Kerguelen', label: 'Indian/Kerguelen (TFT+5)' },
  { value: 'Indian/Mahe', label: 'Indian/Mahe (SCT+4)' },
  { value: 'Indian/Maldives', label: 'Indian/Maldives (MVT+5)' },
  { value: 'Indian/Mauritius', label: 'Indian/Mauritius (MUT+4)' },
  { value: 'Indian/Mayotte', label: 'Indian/Mayotte (EAT+3)' },
  { value: 'Indian/Reunion', label: 'Indian/Reunion (RET+4)' },
  // Pacific
  { value: 'Pacific/Apia', label: 'Pacific/Apia (WST+13)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST+12)' },
  { value: 'Pacific/Chatham', label: 'Pacific/Chatham (CHAST+12:45)' },
  { value: 'Pacific/Chuuk', label: 'Pacific/Chuuk (CHUT+10)' },
  { value: 'Pacific/Easter', label: 'Pacific/Easter (EAST-6)' },
  { value: 'Pacific/Efate', label: 'Pacific/Efate (VUT+11)' },
  { value: 'Pacific/Enderbury', label: 'Pacific/Enderbury (PHOT+13)' },
  { value: 'Pacific/Fakaofo', label: 'Pacific/Fakaofo (TKT+13)' },
  { value: 'Pacific/Fiji', label: 'Pacific/Fiji (FJT+12)' },
  { value: 'Pacific/Funafuti', label: 'Pacific/Funafuti (TVT+12)' },
  { value: 'Pacific/Galapagos', label: 'Pacific/Galapagos (GALT-6)' },
  { value: 'Pacific/Gambier', label: 'Pacific/Gambier (GAMT-9)' },
  { value: 'Pacific/Guadalcanal', label: 'Pacific/Guadalcanal (SBT+11)' },
  { value: 'Pacific/Guam', label: 'Pacific/Guam (ChST+10)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (HST-10)' },
  { value: 'Pacific/Johnston', label: 'Pacific/Johnston (HST-10)' },
  { value: 'Pacific/Kiritimati', label: 'Pacific/Kiritimati (LINT+14)' },
  { value: 'Pacific/Kosrae', label: 'Pacific/Kosrae (KOST+11)' },
  { value: 'Pacific/Kwajalein', label: 'Pacific/Kwajalein (MHT+12)' },
  { value: 'Pacific/Majuro', label: 'Pacific/Majuro (MHT+12)' },
  { value: 'Pacific/Marquesas', label: 'Pacific/Marquesas (MART-9:30)' },
  { value: 'Pacific/Midway', label: 'Pacific/Midway (SST-11)' },
  { value: 'Pacific/Nauru', label: 'Pacific/Nauru (NRT+12)' },
  { value: 'Pacific/Niue', label: 'Pacific/Niue (NUT-11)' },
  { value: 'Pacific/Norfolk', label: 'Pacific/Norfolk (NFT+11:30)' },
  { value: 'Pacific/Noumea', label: 'Pacific/Noumea (NCT+11)' },
  { value: 'Pacific/Pago_Pago', label: 'Pacific/Pago Pago (SST-11)' },
  { value: 'Pacific/Palau', label: 'Pacific/Palau (PWT+9)' },
  { value: 'Pacific/Pitcairn', label: 'Pacific/Pitcairn (PST-8)' },
  { value: 'Pacific/Pohnpei', label: 'Pacific/Pohnpei (PONT+11)' },
  { value: 'Pacific/Port_Moresby', label: 'Pacific/Port Moresby (PGT+10)' },
  { value: 'Pacific/Rarotonga', label: 'Pacific/Rarotonga (CKT-10)' },
  { value: 'Pacific/Saipan', label: 'Pacific/Saipan (ChST+10)' },
  { value: 'Pacific/Tahiti', label: 'Pacific/Tahiti (TAHT-10)' },
  { value: 'Pacific/Tarawa', label: 'Pacific/Tarawa (GILT+12)' },
  { value: 'Pacific/Tongatapu', label: 'Pacific/Tongatapu (TOT+13)' },
  { value: 'Pacific/Wake', label: 'Pacific/Wake (WAKT+12)' },
  { value: 'Pacific/Wallis', label: 'Pacific/Wallis (WFT+12)' },
]

export function ScheduleStep() {
  const { campaignData, updateCampaignData, prevStep, isNew, campaignId } = useWizard()
  const navigate = useNavigate()
  const schedule = campaignData.schedule

  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const uploadLeads = useUploadLeads()
  const launchCampaign = useLaunchCampaign()

  const updateSchedule = (key, value) => {
    updateCampaignData({ schedule: { ...schedule, [key]: value } })
  }

  const buildCampaignPayload = (status) => ({
    name: campaignData.name || 'Untitled Campaign',
    status,
    type: 'outreach',
    linkedin_account_id: campaignData.selectedAccounts[0] || null,
    daily_limit: campaignData.accountLimits.connectionRequests || 20,
    timezone: schedule.timezone || 'UTC',
    sequence_json: campaignData.sequence || { nodes: [], edges: [] },
    settings: {
      schedule: {
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        activeHours: schedule.activeHours,
      },
      dailyLimits: campaignData.accountLimits,
    },
  })

  const saveCampaign = async (status) => {
    if (isNew) {
      return createCampaign.mutateAsync(buildCampaignPayload(status))
    } else {
      return updateCampaign.mutateAsync({ id: campaignId, ...buildCampaignPayload(status) })
    }
  }

  const handleSaveDraft = async () => {
    if (!campaignData.name?.trim()) {
      toast.error('Please enter a campaign name')
      return
    }
    try {
      console.log('[handleSaveDraft] isNew:', isNew, 'leads count:', campaignData.leads?.length)
      const campaign = await saveCampaign('draft')
      console.log('[handleSaveDraft] Campaign created:', campaign)
      if (isNew && campaignData.leads.length > 0) {
        console.log('[handleSaveDraft] Uploading leads:', campaignData.leads.length, 'to campaign:', campaign.id)
        await uploadLeads.mutateAsync({ campaignId: campaign.id, leads: campaignData.leads })
      }
      navigate('/campaigns')
    } catch (err) {
      console.error('[handleSaveDraft] Error:', err)
      toast.error(err.message)
    }
  }

  const handleLaunch = async () => {
    if (!campaignData.name?.trim()) {
      toast.error('Please enter a campaign name')
      return
    }
    try {
      console.log('[handleLaunch] isNew:', isNew, 'leads count:', campaignData.leads?.length)
      const campaign = await saveCampaign('draft')
      console.log('[handleLaunch] Campaign created:', campaign)
      
      // Upload leads if there are any in the wizard context (regardless of isNew status)
      if (campaignData.leads && campaignData.leads.length > 0) {
        console.log('[handleLaunch] Uploading leads:', campaignData.leads.length, 'to campaign:', campaign.id)
        toast.loading(`Uploading ${campaignData.leads.length} leads and fetching LinkedIn profiles...`, { id: 'enrichment' })
        await uploadLeads.mutateAsync({ campaignId: campaign.id, leads: campaignData.leads })
        toast.dismiss('enrichment')
        console.log('[handleLaunch] Leads uploaded and enriched successfully')
      }
      
      await launchCampaign.mutateAsync(campaign.id)
      navigate('/campaigns')
    } catch (err) {
      console.error('[handleLaunch] Error:', err)
      toast.dismiss('enrichment')
      toast.error(err.message)
    }
  }

  const isSaving = createCampaign.isPending || updateCampaign.isPending || uploadLeads.isPending || launchCampaign.isPending

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Campaign Schedule</h2>
        <p className="text-muted-foreground">
          Configure when your campaign will run and active hours
        </p>
      </div>

      {/* Start/End Dates */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Campaign Duration</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="dd/mm/yyyy"
                value={formatDateDisplay(schedule.startDate)}
                onChange={(e) => {
                  const parsed = parseDateInput(e.target.value)
                  if (parsed) updateSchedule('startDate', parsed)
                }}
                className="pr-10"
              />
              <input
                type="date"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 cursor-pointer"
                min={getTodayString()}
                value={schedule.startDate || ''}
                onChange={(e) => updateSchedule('startDate', e.target.value)}
              />
              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>End Date (Optional)</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="dd/mm/yyyy"
                value={formatDateDisplay(schedule.endDate)}
                onChange={(e) => {
                  const parsed = parseDateInput(e.target.value)
                  if (parsed) updateSchedule('endDate', parsed)
                }}
                className="pr-10"
              />
              <input
                type="date"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 cursor-pointer"
                min={schedule.startDate || getTodayString()}
                value={schedule.endDate || ''}
                onChange={(e) => updateSchedule('endDate', e.target.value)}
              />
              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={!schedule.endDate}
            onCheckedChange={(checked) => {
              if (checked) {
                updateSchedule('endDate', null)
              } else {
                // Set default end date to 30 days from start
                const start = new Date(schedule.startDate || getTodayString())
                const end = new Date(start)
                end.setDate(end.getDate() + 30)
                const endStr = end.toISOString().split('T')[0]
                updateSchedule('endDate', endStr)
              }
            }}
          />
          <Label className="cursor-pointer">Run indefinitely (no end date)</Label>
        </div>
      </Card>

      {/* Active Hours */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Active Hours</h3>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <TimezoneSelect
            value={schedule.timezone}
            onChange={(tz) => updateSchedule('timezone', tz)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input 
              type="time" 
              value={schedule.activeHours.start}
              onChange={(e) => updateSchedule('activeHours', { ...schedule.activeHours, start: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input 
              type="time" 
              value={schedule.activeHours.end}
              onChange={(e) => updateSchedule('activeHours', { ...schedule.activeHours, end: e.target.value })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Campaign actions will only be sent during these hours in the selected timezone.
        </p>
      </Card>

      {/* Summary */}
      <Card className="p-6 bg-muted/30">
        <h3 className="font-semibold mb-4">Campaign Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="campaign-name">Campaign Name <span className="text-destructive">*</span></Label>
            <Input
              id="campaign-name"
              value={campaignData.name || ''}
              onChange={(e) => updateCampaignData({ name: e.target.value })}
              placeholder="e.g. Q2 Outreach — Marketing Managers"
              className="h-10"
            />
          </div>
          <div>
            <span className="text-muted-foreground">Leads:</span>
            <p className="font-medium">{campaignData.leads.length} leads</p>
          </div>
          <div>
            <span className="text-muted-foreground">LinkedIn Accounts:</span>
            <p className="font-medium">{campaignData.selectedAccounts.length} accounts</p>
          </div>
          <div>
            <span className="text-muted-foreground">Daily Connection Limit:</span>
            <p className="font-medium">{campaignData.accountLimits.connectionRequests} per account</p>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={prevStep}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Sequences
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Draft
          </Button>
          <Button onClick={handleLaunch} className="bg-primary" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            Launch Campaign
          </Button>
        </div>
      </div>
    </div>
  )
}

// Searchable Timezone Select Component
function TimezoneSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const dropdownRef = React.useRef(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset search when opening
  React.useEffect(() => {
    if (isOpen) setSearch('')
  }, [isOpen])

  const filteredTimezones = React.useMemo(() => {
    if (!search.trim()) return TIMEZONES
    const query = search.toLowerCase()
    return TIMEZONES.filter(tz =>
      tz.label.toLowerCase().includes(query) ||
      tz.value.toLowerCase().includes(query)
    )
  }, [search])

  const selectedLabel = TIMEZONES.find(tz => tz.value === value)?.label || value

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-background border rounded-lg px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-[300px] overflow-hidden">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search timezone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[240px]">
            {filteredTimezones.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground text-center">No timezones found</p>
            ) : (
              filteredTimezones.map(tz => (
                <button
                  key={tz.value}
                  type="button"
                  onClick={() => {
                    onChange(tz.value)
                    setIsOpen(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center justify-between transition-colors ${
                    tz.value === value ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  <span className="truncate">{tz.label}</span>
                  {tz.value === value && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
