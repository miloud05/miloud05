export type Zone = "north" | "highlands" | "south";

export interface Wilaya {
  code: number;
  fr: string;
  ar: string;
  zone: Zone;
}

const RAW: Array<[number, string, string, Zone]> = [
  [1, "Adrar", "أدرار", "south"],
  [2, "Chlef", "الشلف", "north"],
  [3, "Laghouat", "الأغواط", "highlands"],
  [4, "Oum El Bouaghi", "أم البواقي", "highlands"],
  [5, "Batna", "باتنة", "highlands"],
  [6, "Béjaïa", "بجاية", "north"],
  [7, "Biskra", "بسكرة", "south"],
  [8, "Béchar", "بشار", "south"],
  [9, "Blida", "البليدة", "north"],
  [10, "Bouira", "البويرة", "north"],
  [11, "Tamanrasset", "تمنراست", "south"],
  [12, "Tébessa", "تبسة", "highlands"],
  [13, "Tlemcen", "تلمسان", "north"],
  [14, "Tiaret", "تيارت", "highlands"],
  [15, "Tizi Ouzou", "تيزي وزو", "north"],
  [16, "Alger", "الجزائر", "north"],
  [17, "Djelfa", "الجلفة", "highlands"],
  [18, "Jijel", "جيجل", "north"],
  [19, "Sétif", "سطيف", "highlands"],
  [20, "Saïda", "سعيدة", "highlands"],
  [21, "Skikda", "سكيكدة", "north"],
  [22, "Sidi Bel Abbès", "سيدي بلعباس", "north"],
  [23, "Annaba", "عنابة", "north"],
  [24, "Guelma", "قالمة", "north"],
  [25, "Constantine", "قسنطينة", "north"],
  [26, "Médéa", "المدية", "north"],
  [27, "Mostaganem", "مستغانم", "north"],
  [28, "M'Sila", "المسيلة", "highlands"],
  [29, "Mascara", "معسكر", "north"],
  [30, "Ouargla", "ورقلة", "south"],
  [31, "Oran", "وهران", "north"],
  [32, "El Bayadh", "البيض", "highlands"],
  [33, "Illizi", "إليزي", "south"],
  [34, "Bordj Bou Arréridj", "برج بوعريريج", "highlands"],
  [35, "Boumerdès", "بومرداس", "north"],
  [36, "El Tarf", "الطارف", "north"],
  [37, "Tindouf", "تندوف", "south"],
  [38, "Tissemsilt", "تيسمسيلت", "highlands"],
  [39, "El Oued", "الوادي", "south"],
  [40, "Khenchela", "خنشلة", "highlands"],
  [41, "Souk Ahras", "سوق أهراس", "north"],
  [42, "Tipaza", "تيبازة", "north"],
  [43, "Mila", "ميلة", "north"],
  [44, "Aïn Defla", "عين الدفلى", "north"],
  [45, "Naâma", "النعامة", "highlands"],
  [46, "Aïn Témouchent", "عين تموشنت", "north"],
  [47, "Ghardaïa", "غرداية", "south"],
  [48, "Relizane", "غليزان", "north"],
  [49, "Timimoun", "تيميمون", "south"],
  [50, "Bordj Badji Mokhtar", "برج باجي مختار", "south"],
  [51, "Ouled Djellal", "أولاد جلال", "south"],
  [52, "Béni Abbès", "بني عباس", "south"],
  [53, "In Salah", "عين صالح", "south"],
  [54, "In Guezzam", "عين قزام", "south"],
  [55, "Touggourt", "تقرت", "south"],
  [56, "Djanet", "جانت", "south"],
  [57, "El M'Ghair", "المغير", "south"],
  [58, "El Meniaa", "المنيعة", "south"],
];

export const WILAYAS: readonly Wilaya[] = RAW.map(([code, fr, ar, zone]) => ({ code, fr, ar, zone }));

export function wilayaZone(code: number): Zone {
  return WILAYAS.find((w) => w.code === Number(code))?.zone ?? "north";
}

export function wilayaName(code: number | string | undefined, lang: "fr" | "ar" = "fr"): string {
  const w = WILAYAS.find((x) => x.code === Number(code));
  if (!w) return "—";
  return `${String(w.code).padStart(2, "0")} - ${lang === "ar" ? w.ar : w.fr}`;
}
