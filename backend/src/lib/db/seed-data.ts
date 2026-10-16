// AUTO-GENERATED from docs/data/Case-Allocation.xlsx ("July 2031 Allocation" sheet).
// Weekly recurring pattern: MWF = Mon/Wed/Fri, TT = Tue/Thu. Regenerate rather than hand-edit if the sheet changes.
// Note: "Brock/Luke" style entries (alternating children) are expanded into one row per child.

import type { Location, Rank, Slot } from "@/lib/types";

export const SEED_THERAPISTS: { name: string; rank: Rank; isPartTime: boolean; homeArea: string }[] = [
  {
    "name": "Anika",
    "rank": "SBT",
    "isPartTime": true,
    "homeArea": "Punggol"
  },
  {
    "name": "Jennifer",
    "rank": "SBT",
    "isPartTime": false,
    "homeArea": "CCK / Khatib"
  },
  {
    "name": "Kourtney",
    "rank": "SBT",
    "isPartTime": false,
    "homeArea": "Tampines"
  },
  {
    "name": "Jia Yi",
    "rank": "SBT",
    "isPartTime": false,
    "homeArea": "Hougang"
  },
  {
    "name": "Isabelle",
    "rank": "SBT",
    "isPartTime": true,
    "homeArea": "Sembawang"
  },
  {
    "name": "Alexa",
    "rank": "SBT",
    "isPartTime": false,
    "homeArea": "Tampines"
  },
  {
    "name": "Celine",
    "rank": "SBT",
    "isPartTime": false,
    "homeArea": "Sembawang"
  },
  {
    "name": "Eileen",
    "rank": "SBT",
    "isPartTime": false,
    "homeArea": "Yishun"
  },
  {
    "name": "Heather",
    "rank": "LBT",
    "isPartTime": true,
    "homeArea": "Chinatown"
  },
  {
    "name": "Rory",
    "rank": "LBT",
    "isPartTime": false,
    "homeArea": "Marine Parade"
  },
  {
    "name": "Vidya",
    "rank": "LBT",
    "isPartTime": false,
    "homeArea": "Bukit Panjang"
  },
  {
    "name": "Kai Ling",
    "rank": "BT",
    "isPartTime": false,
    "homeArea": "Marine Parade"
  },
  {
    "name": "Li Ting",
    "rank": "BT",
    "isPartTime": false,
    "homeArea": "Yishun"
  },
  {
    "name": "Tara",
    "rank": "BT",
    "isPartTime": false,
    "homeArea": "Stevens"
  },
  {
    "name": "Jade",
    "rank": "BT",
    "isPartTime": false,
    "homeArea": "Clementi"
  },
  {
    "name": "Valentina",
    "rank": "BT",
    "isPartTime": false,
    "homeArea": "Kembangan"
  },
  {
    "name": "Lilian",
    "rank": "BT",
    "isPartTime": false,
    "homeArea": "Bedok"
  },
  {
    "name": "Amelia",
    "rank": "BT",
    "isPartTime": false,
    "homeArea": "Dhoby Ghaut"
  },
  {
    "name": "Farah",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Tan Kah Kee"
  },
  {
    "name": "Jacqueline",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Lorong Chuan"
  },
  {
    "name": "Jamie",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Serangoon"
  },
  {
    "name": "Camila",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Hougang"
  },
  {
    "name": "Juliana",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Lorong Chuan"
  },
  {
    "name": "Mark",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Havelock"
  },
  {
    "name": "Ji-Eun",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Ang Mo Kio"
  },
  {
    "name": "Nadya",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Teck Whye"
  },
  {
    "name": "Jasmine",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Serangoon"
  },
  {
    "name": "Dahlia",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Punggol"
  },
  {
    "name": "Geraldine",
    "rank": "PT",
    "isPartTime": false,
    "homeArea": "Choa Chu Kang"
  }
];

export const SEED_STUDENTS: string[] = ["Ally", "Anson", "Anthony", "Arya", "Benedict", "Brock", "Callista", "Carl", "Elias", "Gracie", "Hughie", "Jake", "Jeremy", "Joel", "June", "Kai Jun", "Lisa", "Lloyd", "Lola", "Luke", "Mallory", "Margaret", "Noddy", "Patrick", "Richard", "Sasha", "Winnie", "Yan", "Yves", "Zachary"];

export const SEED_WEEKLY_PATTERN: {
  therapist: string;
  days: "MWF" | "TT";
  slot: Slot;
  start: string;
  end: string;
  student: string;
  location: Location;
}[] = [
  {
    "therapist": "Anika",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Lola",
    "location": "clinic"
  },
  {
    "therapist": "Anika",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Noddy",
    "location": "clinic"
  },
  {
    "therapist": "Anika",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Callista",
    "location": "clinic"
  },
  {
    "therapist": "Jennifer",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Noddy",
    "location": "clinic"
  },
  {
    "therapist": "Jennifer",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Brock",
    "location": "clinic"
  },
  {
    "therapist": "Jennifer",
    "days": "MWF",
    "slot": "PM",
    "start": "14:30",
    "end": "17:30",
    "student": "Kai Jun",
    "location": "home"
  },
  {
    "therapist": "Jennifer",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Luke",
    "location": "clinic"
  },
  {
    "therapist": "Kourtney",
    "days": "MWF",
    "slot": "AM",
    "start": "08:45",
    "end": "12:15",
    "student": "Richard",
    "location": "school"
  },
  {
    "therapist": "Kourtney",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Elias",
    "location": "clinic"
  },
  {
    "therapist": "Kourtney",
    "days": "MWF",
    "slot": "PM",
    "start": "14:15",
    "end": "17:45",
    "student": "Richard",
    "location": "school"
  },
  {
    "therapist": "Kourtney",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Jeremy",
    "location": "clinic"
  },
  {
    "therapist": "Jia Yi",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Elias",
    "location": "clinic"
  },
  {
    "therapist": "Jia Yi",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Lola",
    "location": "clinic"
  },
  {
    "therapist": "Jia Yi",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Jeremy",
    "location": "clinic"
  },
  {
    "therapist": "Jia Yi",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Noddy",
    "location": "home"
  },
  {
    "therapist": "Isabelle",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Mallory",
    "location": "clinic"
  },
  {
    "therapist": "Isabelle",
    "days": "TT",
    "slot": "PM",
    "start": "15:15",
    "end": "17:45",
    "student": "Arya",
    "location": "home"
  },
  {
    "therapist": "Alexa",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Mallory",
    "location": "clinic"
  },
  {
    "therapist": "Celine",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Benedict",
    "location": "clinic"
  },
  {
    "therapist": "Celine",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Noddy",
    "location": "home"
  },
  {
    "therapist": "Celine",
    "days": "TT",
    "slot": "PM",
    "start": "14:30",
    "end": "17:30",
    "student": "Benedict",
    "location": "home"
  },
  {
    "therapist": "Eileen",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Brock",
    "location": "clinic"
  },
  {
    "therapist": "Eileen",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Luke",
    "location": "clinic"
  },
  {
    "therapist": "Eileen",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Hughie",
    "location": "clinic"
  },
  {
    "therapist": "Eileen",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Lola",
    "location": "clinic"
  },
  {
    "therapist": "Eileen",
    "days": "TT",
    "slot": "PM",
    "start": "14:45",
    "end": "17:15",
    "student": "Hughie",
    "location": "home"
  },
  {
    "therapist": "Heather",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Joel",
    "location": "school"
  },
  {
    "therapist": "Heather",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Joel",
    "location": "school"
  },
  {
    "therapist": "Rory",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Callista",
    "location": "clinic"
  },
  {
    "therapist": "Rory",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Callista",
    "location": "clinic"
  },
  {
    "therapist": "Rory",
    "days": "MWF",
    "slot": "PM",
    "start": "14:15",
    "end": "16:45",
    "student": "Yves",
    "location": "clinic"
  },
  {
    "therapist": "Rory",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Lola",
    "location": "clinic"
  },
  {
    "therapist": "Vidya",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "June",
    "location": "clinic"
  },
  {
    "therapist": "Vidya",
    "days": "TT",
    "slot": "AM",
    "start": "08:45",
    "end": "12:15",
    "student": "Richard",
    "location": "school"
  },
  {
    "therapist": "Vidya",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Callista",
    "location": "clinic"
  },
  {
    "therapist": "Vidya",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Richard",
    "location": "clinic"
  },
  {
    "therapist": "Kai Ling",
    "days": "MWF",
    "slot": "AM",
    "start": "08:45",
    "end": "12:00",
    "student": "Hughie",
    "location": "school"
  },
  {
    "therapist": "Kai Ling",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Lloyd",
    "location": "clinic"
  },
  {
    "therapist": "Kai Ling",
    "days": "MWF",
    "slot": "PM",
    "start": "15:00",
    "end": "17:00",
    "student": "Patrick",
    "location": "home"
  },
  {
    "therapist": "Kai Ling",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Brock",
    "location": "clinic"
  },
  {
    "therapist": "Li Ting",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Yan",
    "location": "clinic"
  },
  {
    "therapist": "Li Ting",
    "days": "MWF",
    "slot": "PM",
    "start": "15:15",
    "end": "17:45",
    "student": "Margaret",
    "location": "home"
  },
  {
    "therapist": "Li Ting",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Jake",
    "location": "clinic"
  },
  {
    "therapist": "Tara",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Anthony",
    "location": "clinic"
  },
  {
    "therapist": "Tara",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Joel",
    "location": "clinic"
  },
  {
    "therapist": "Tara",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Elias",
    "location": "clinic"
  },
  {
    "therapist": "Valentina",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Benedict",
    "location": "clinic"
  },
  {
    "therapist": "Valentina",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Yan",
    "location": "clinic"
  },
  {
    "therapist": "Valentina",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Yan",
    "location": "clinic"
  },
  {
    "therapist": "Lilian",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Zachary",
    "location": "clinic"
  },
  {
    "therapist": "Lilian",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Ally",
    "location": "clinic"
  },
  {
    "therapist": "Lilian",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Joel",
    "location": "clinic"
  },
  {
    "therapist": "Amelia",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Jeremy",
    "location": "clinic"
  },
  {
    "therapist": "Amelia",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Jeremy",
    "location": "clinic"
  },
  {
    "therapist": "Amelia",
    "days": "MWF",
    "slot": "PM",
    "start": "14:30",
    "end": "17:00",
    "student": "Anson",
    "location": "home"
  },
  {
    "therapist": "Amelia",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Gracie",
    "location": "clinic"
  },
  {
    "therapist": "Farah",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Yan",
    "location": "clinic"
  },
  {
    "therapist": "Farah",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Kai Jun",
    "location": "clinic"
  },
  {
    "therapist": "Jacqueline",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Gracie",
    "location": "clinic"
  },
  {
    "therapist": "Jacqueline",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Sasha",
    "location": "clinic"
  },
  {
    "therapist": "Jacqueline",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Elias",
    "location": "clinic"
  },
  {
    "therapist": "Jacqueline",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Ally",
    "location": "clinic"
  },
  {
    "therapist": "Jamie",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Carl",
    "location": "clinic"
  },
  {
    "therapist": "Jamie",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Benedict",
    "location": "clinic"
  },
  {
    "therapist": "Jamie",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Lisa",
    "location": "clinic"
  },
  {
    "therapist": "Camila",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Gracie",
    "location": "clinic"
  },
  {
    "therapist": "Camila",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Gracie",
    "location": "clinic"
  },
  {
    "therapist": "Camila",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Winnie",
    "location": "clinic"
  },
  {
    "therapist": "Juliana",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Anthony",
    "location": "clinic"
  },
  {
    "therapist": "Juliana",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Lisa",
    "location": "clinic"
  },
  {
    "therapist": "Juliana",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Lloyd",
    "location": "clinic"
  },
  {
    "therapist": "Mark",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Patrick",
    "location": "clinic"
  },
  {
    "therapist": "Mark",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Patrick",
    "location": "clinic"
  },
  {
    "therapist": "Mark",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Jake",
    "location": "clinic"
  },
  {
    "therapist": "Ji-Eun",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Zachary",
    "location": "clinic"
  },
  {
    "therapist": "Nadya",
    "days": "TT",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "June",
    "location": "clinic"
  },
  {
    "therapist": "Jasmine",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Luke",
    "location": "clinic"
  },
  {
    "therapist": "Jasmine",
    "days": "MWF",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Brock",
    "location": "clinic"
  },
  {
    "therapist": "Dahlia",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Carl",
    "location": "clinic"
  },
  {
    "therapist": "Dahlia",
    "days": "TT",
    "slot": "PM",
    "start": "14:00",
    "end": "17:30",
    "student": "Patrick",
    "location": "clinic"
  },
  {
    "therapist": "Geraldine",
    "days": "MWF",
    "slot": "AM",
    "start": "08:30",
    "end": "12:00",
    "student": "Sasha",
    "location": "clinic"
  }
];

// Slots a (part-time) therapist does not work, marked "x" in the sheet.
export const SEED_OFF_SLOTS: { therapist: string; days: "MWF" | "TT"; slot: Slot }[] = [
  {
    "therapist": "Anika",
    "days": "MWF",
    "slot": "PM"
  },
  {
    "therapist": "Isabelle",
    "days": "MWF",
    "slot": "AM"
  },
  {
    "therapist": "Isabelle",
    "days": "TT",
    "slot": "AM"
  },
  {
    "therapist": "Heather",
    "days": "MWF",
    "slot": "PM"
  },
  {
    "therapist": "Heather",
    "days": "TT",
    "slot": "PM"
  }
];
