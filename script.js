//การบอกว่าไฟล์ script.js มาถึงเบราว์เซอร์เรียบร้อยแล้ว
console.log("script loaded"); 

// ═══════════════════════════════════════════════════════════
//  GLOBAL VARIABLES ตัวแปรที่ประกาศไว้นอกฟังก์ชัน ทำให้ทุกฟังก์ชันในไฟล์เรียกใช้และแก้ไขค่าร่วมกันได้
// ═══════════════════════════════════════════════════════════
let dorms = [];                       // ข้อมูลหอพักทั้งหมด
let dormLayer;                        // จุดหอพักสีๆชุดปัจจุบัน ถูกลบ-สร้างใหม่ทุกครั้งที่ผู้ใช้เปลี่ยนตัวกรอง
let markersByRank = {}; //* ลองรันเฉยๆๆๆๆ */
let selectedHousingType = "all";      // ตัวกรองประเภทที่พัก (default ตรงกับ HTML)
let selectedGenderType = "both";      // ตัวกรองเพศ (default ตรงกับ HTML) both = หอพักรวม
let selectedFacultyKey = null;        // รหัสคณะที่ผู้ใช้เลือก ใช้ค้นหาระยะทางคู่กับ facultyDistanceField
let facultyMarker = null;             // เก็บ "หมุดของคณะที่ผู้ใช้เลือกไว้" 
let faculties = {};                   // เก็บพิกัดคณะทั้งหมด key=รหัสคณะ รอโหลดจาก fetch
let requestedAmenities = [];          // สิ่งอำนวยความสะดวกที่ผู้ใช้ติ๊กต้องการ (ใช้เตือนสีแดง ไม่ใช้กรอง)
//ตัวอย่าง ประกาศ dorms เป็นอาร์เรย์ว่างไว้ก่อน 
// เพื่อรอรับข้อมูลจาก GeoJSON ที่โหลดแบบ asynchronous (ไม่รอ) ผ่าน fetch() 
// ใช้ let เพราะต้องเขียนทับค่าตอนโหลดเสร็จ


// ═══════════════════════════════════════════════════════════
//  MAPPING: faculty key → ชื่อ field ระยะทางใน GeoJSON 104 หอไป 22คณะ
// ═══════════════════════════════════════════════════════════
const facultyDistanceField = { //ตารางแปลงชื่อ 
  khonkaenuniversity: "kku_cost",
  medicine:           "medicine_cost",
  medicalsciences:    "medicalsciences_cost",  
  pharmacy:           "pharmacy_cost",
  engineering:        "engineering_cost",
  law:                "law_cost",
  science:            "science_cost", //อย่าลืมแก้ใน js
  nursing:            "nursing_cost",
  economics:          "economics_cost",
  computing:          "computing_cost",
  architecture:       "architecture_cost",
  publichealth:       "publichealth_cost",
  humanities:         "humanities_cost",
  business:           "business_cost",
  finearts:           "finearts_cost",
  localadmin:         "localadmin_cost",
  international:      "international_cost",
  education:          "education_cost",
  agriculture:        "agriculture_cost",
  technology:         "technology_cost",
  veterinary:         "veterinary_cost",
  dentistry:          "dentistry_cost",
};


// ═══════════════════════════════════════════════════════════ **เเก้
//  SURVEY WEIGHTS  (ค่าจริงจากแบบสอบถาม — Rank Sum Method)
//
//  ปัจจัย               Mean     RANK  Rank Value  Weight
//  1. ระยะทางคณะ/มหา    4.75      3       10      0.1282
//  2. ร้านอาหาร          4.464     5        8      0.1026
//  3. โรงพยาบาล          3.595    10        3      0.0385
//  4. ร้านสะดวกซื้อ      4.452     6        7      0.0897
//  5. สวนสาธารณะ         3.643     9        4      0.0513
//  6. สถานบันเทิง        2.976    12        1      0.0128
//  7. ราคาเช่า           4.833     1       12      0.1538
//  8. ที่จอดรถ           4.542     4        9      0.1154 //ไม่เอามาคิดแล้ว
//  9. ขนส่งสาธารณะ      3.205    11        2      0.0256
// 10. จำนวนผู้เข้าพัก    3.845     8        5      0.0641
// 11. ลักษณะห้องน้ำ      4.762     2       11      0.1410
// 12. สิ่งอำนวยความสะดวก 4.417    7        6      0.0769
// ═══════════════════════════════════════════════════════════

const DEFAULT_AMENITY_WEIGHTS = Object.freeze({ 
  wifi:       0.136842105, 
  air_con:    0.121052632, 
  furniture:  0.131578947, 
  appliance:  0.117543860, 
  elevator:   0.115789474, 
  comm_area:  0.108771930, 
  cctv:       0.135087719, 
  keycard:    0.133333333 
}); 
 
const AMENITY_FIELDS = Object.keys(DEFAULT_AMENITY_WEIGHTS); 
// อ่านรายการสิ่งอำนวยความสะดวกที่ผู้ใช้เลือก
function getSelectedAmenities() {
  return Array.from(
    document.querySelectorAll(
      '.amenity-grid input[type="checkbox"]:checked'
    ),
    checkbox => checkbox.value
  ).filter(key => AMENITY_FIELDS.includes(key));
}


function calculateAmenityScore(d, selectedAmenities = []) {
  const hasSelection = selectedAmenities.length > 0;
  // มีการเลือก → ใช้เฉพาะรายการที่เลือก
  // ไม่เลือกเลย → ใช้ทั้ง 8 กลุ่ม
  const activeFields = hasSelection
    ? selectedAmenities
    : AMENITY_FIELDS;

  let weightedSum = 0;
  let selectedWeightSum = 0;

  for (const key of activeFields) {
    // q_k: น้ำหนัก Default
    const q = DEFAULT_AMENITY_WEIGHTS[key];

    // a_ik: ที่พักมี = 1, ไม่มี = 0
    // รองรับ Boolean true/false และตัวเลข 1/0
    const a = (d[key] === true || d[key] === 1) ? 1 : 0;

    weightedSum += q * a;
    selectedWeightSum += q;
  }

  // ไม่ติ๊ก: A_i = Σ(q_k × a_ik)
  if (!hasSelection) {
    return weightedSum;
  }

  // มีการติ๊ก: A_i = Σ(q_k × p_k × a_ik) / Σ(q_k × p_k)
  return weightedSum / selectedWeightSum;
}

// ไอคอนของแต่ละสิ่งอำนวยความสะดวก (ใช้วาดวงกลมใน popup)
const AMENITY_ICONS = [
  { key: "wifi",      icon: "ti-wifi" },
  { key: "air_con",   icon: "ti-snowflake" },
  { key: "furniture", icon: "ti-armchair" },
  { key: "appliance", icon: "ti-plug" },
  { key: "elevator",  icon: "ti-elevator" },
  { key: "comm_area", icon: "ti-users" },
  { key: "cctv",      icon: "ti-video" },
  { key: "keycard",   icon: "ti-id" },
];

// ชื่อภาษาไทยของแต่ละอย่าง (ใช้ในข้อความเตือนสีแดง)
const AMENITY_LABELS = {
  wifi: "Wi-Fi", air_con: "แอร์", furniture: "เฟอร์นิเจอร์",
  appliance: "เครื่องใช้ไฟฟ้า", elevator: "ลิฟต์", comm_area: "พื้นที่ส่วนกลาง",
  cctv: "กล้องวงจรปิด", keycard: "คีย์การ์ด",
};

// วาดแถววงกลมไอคอน 11 อัน เขียว = มี, เทาจาง = ไม่มี
// เตือนสีแดง: สิ่งอำนวยความสะดวกที่ผู้ใช้ติ๊กไว้ แต่หอนี้ไม่มี
function renderAmenityAlert(d) {
  const missing = requestedAmenities.filter(k => !d[k]);
  if (!missing.length) return "";
  return `<div class="amenity-alert">` +
    missing.map(k => `<div><i class="ti ti-alert-circle"></i> ไม่มี${AMENITY_LABELS[k] ?? k}</div>`).join("") +
    `</div>`;
}

function renderAmenityIcons(d) {
  return `<div class="amenity-icons">` +
    AMENITY_ICONS.map(a =>
      `<span class="amenity-icn ${d[a.key] ? "on" : "off"}"><i class="ti ${a.icon}"></i></span>`
    ).join("") +
    `</div>`;
}


const SURVEY_WEIGHTS = {
price: 0.1667,
distance: 0.1364, 
bathroom: 0.1515,
food: 0.1212,
cvs: 0.1061,
amenity: 0.0909,
occupants: 0.0758,
park: 0.0606,  //สวนสาธารณะ
hospital: 0.0455,
transport: 0.0303,
entertain: 0.0152
};

const CRITERIA = [
  { key: "price",     label: "ราคาเช่า",             direction: "lower_better"  },
  { key: "distance",  label: "ระยะทางจากคณะ",         direction: "lower_better"  },
  { key: "bathroom",  label: "ลักษณะห้องน้ำ",         direction: "higher_better" }, // 1=รวม, 2=ส่วนตัว
  { key: "food",      label: "ร้านอาหารใกล้เคียง",    direction: "lower_better"  }, // ระยะทาง เมตร
  { key: "cvs",       label: "ร้านสะดวกซื้อ",          direction: "lower_better"  }, // ระยะทาง เมตร
  { key: "amenity",   label: "สิ่งอำนวยความสะดวก",    direction: "higher_better" }, // คะแนนรวม 0–N
  { key: "occupants", label: "จำนวนผู้เข้าพัก",        direction: "lower_better"  }, // คนต่อห้อง
  { key: "park",      label: "พื้นที่สีเขียว",          direction: "lower_better"  }, // ระยะทาง เมตร
  { key: "hospital",  label: "โรงพยาบาล",             direction: "lower_better"  }, // ระยะทาง เมตร
  { key: "transport", label: "ขนส่งสาธารณะ",           direction: "lower_better"  }, // ระยะทาง เมตร
  { key: "entertain", label: "สถานบันเทิง",            direction: "lower_better"  }, // ระยะทาง เมตร
];


// ═══════════════════════════════════════════════════════════
//  GET USER WEIGHTS จาก slider บนหน้าเว็บ
// ═══════════════════════════════════════════════════════════


function getUserWeights() {
  return {
    price:     Number(document.getElementById("imp_price").value),
    distance:  Number(document.getElementById("imp_distance").value),
    bathroom:  Number(document.getElementById("imp_bathroom")?.value   ?? 3),
    food:      Number(document.getElementById("imp_food").value),
    cvs:       Number(document.getElementById("imp_cvs").value),
    amenity:   Number(document.getElementById("imp_amenity")?.value    ?? 3),
    occupants: Number(document.getElementById("imp_occupants")?.value  ?? 3),
    park:      Number(document.getElementById("imp_park").value),
    hospital:  Number(document.getElementById("imp_hospital").value),
    transport: Number(document.getElementById("imp_transport").value),
    entertain: Number(document.getElementById("imp_entertain")?.value  ?? 3),
  };
} 



// ไปอ่านค่าปัจจุบันของแถบเลื่อนน้ำหนัก MCA แล้วรวบรวมส่งกลับมาเป็น object เดียว
  //ได้ค่าเป็น "สตริง" แปลงสตริงนั้นให้เป็น "ตัวเลขจริง" Number()


// ═══════════════════════════════════════════════════════════
//  ฟังก์ชั่นกล่องแจ้งเตือน Disclaimer
// ═══════════════════════════════════════════════════════════
function closeDisclaimer() {
  document.getElementById('disclaimerOverlay').style.display = 'none';
  // ถ้าอยากให้เตือนแค่ครั้งแรกที่เปิด (จำไว้ใน browser)
  localStorage.setItem('disclaimerSeen', 'true');
  toggleDrawer(true); 
}

// ถ้าต้องการให้ไม่ต้องกดซ้ำทุกครั้งที่เข้าเว็บ ให้เพิ่มบล็อกนี้
//if (localStorage.getItem('disclaimerSeen') === 'true') {
//  document.getElementById('disclaimerOverlay').style.display = 'none';
//}


// ═══════════════════════════════════════════════════════════
//  EXTRACT RAW VALUES จากข้อมูลหอพัก 1 แห่ง
//  แปลงให้ตรงกับ key ใน CRITERIA
// ═══════════════════════════════════════════════════════════

function extractValues(d, selectedAmenities = []) {
  const MAX_DIST = 99999;

  // ระยะทางถึงคณะที่เลือก
  let dist = MAX_DIST;
  if (selectedFacultyKey && facultyDistanceField[selectedFacultyKey]) {
    const field = facultyDistanceField[selectedFacultyKey];
    const val   = d[field];
    dist = (val != null && !isNaN(val)) ? val : MAX_DIST;
  }

const amenityScore = calculateAmenityScore(
  d,
  selectedAmenities
);

  return {
    price:     d.price_min          ?? MAX_DIST,  // บาท/เดือน (lower_better)
    distance:  dist,                              // เมตร (lower_better) 
    bathroom:  d.bath_pv ? 2 : 1,                 // true = ส่วนตัว(2), false = รวม(1)   
    park:      d.parkmin_min        ?? MAX_DIST,  // มี/ไม่มี (higher_better)
    food:      d.restaurantmin_min  ?? MAX_DIST,  // เมตร   (lower_better)
    cvs:       d.storemin_min       ?? MAX_DIST,  // เมตร   (lower_better)
    amenity:   amenityScore,                      // คะแนน 0–1,(higher_better)
    occupants: d.occupants_per_room ?? MAX_DIST,  // คน/ห้อง  (lower_better)
    hospital:  d.hospitalmin_min    ?? MAX_DIST,  // เมตร     (lower_better)
    transport: d.kkutransitmin_min  ?? MAX_DIST,  // เมตร     (lower_better)
    entertain: d.entertainmin_min   ?? MAX_DIST,  // เมตร     (lower_better)
  };
}


// ═══════════════════════════════════════════════════════════
//  MCA RANK-SUM (core algorithm)
//
//  ขั้นตอน:
//    1. combined weight = surveyW × userW  (คูณกัน)
//    2. normalize combined weights → รวม = 1
//    3. จัดอันดับหอพักแต่ละปัจจัย (rank 1 = ดีสุด)
//       → tie ใช้ average rank
//    4. weighted rank sum = Σ (normW × rank)
//    5. score 0–100: rank sum ต่ำ → score สูง
// ═══════════════════════════════════════════════════════════
function computeRankSumMCA(dormList) {

  if (!dormList || dormList.length === 0) return [];

  const userW = getUserWeights();
  const selectedAmenities = getSelectedAmenities();

   //Step 1 ใช้สมการ (3.2): ส่วนตัวเศษ = WS_j × WU_j 
  const combined = {};
  CRITERIA.forEach(c => {
    combined[c.key] =
      (SURVEY_WEIGHTS[c.key] ?? 1) * (userW[c.key] ?? 1);
  });

  //  Step 2 สมการ (3.2): ส่วนตัวหาร Σ(WS_k × WU_k) //
  // normalize → รวม = 1 //
  const totalW = Object.values(combined).reduce(
    (a, b) => a + b, 0
  );

  const normW = {};

  CRITERIA.forEach(c => {
    normW[c.key] = combined[c.key] / totalW;
  });


 // ── Step 3 เตรียมข้อมูลสำหรับสมการ (3.3) ─────────────────────



  // ดึงค่าปัจจัยของที่พักแต่ละแห่ง เช่น ราคาและระยะทาง
  const enriched = dormList.map(d => ({
    ...d,
    _values: extractValues(d, selectedAmenities),
  }));

   // เก็บผลลัพธ์ r_ij 
  const rankMap = {}; 

  CRITERIA.forEach(c => { 
   const sorted = [...enriched]
      .map((d, i) => ({
        i,
        v: d._values[c.key] ?? 0
      }))
      .sort((a, b) =>
        c.direction === "lower_better"
          ? a.v - b.v
          : b.v - a.v
      );

    rankMap[c.key] = new Array(enriched.length);

    // ── สมการ (3.3): อันดับแบบเฉลี่ยเมื่อค่าเท่ากัน ──────
    // r_ij = B_ij + (T_ij + 1) / 2
    let pos = 0;

    while (pos < sorted.length) {
      let end = pos;
      const val = sorted[pos].v;

      while (end < sorted.length && sorted[end].v === val) {
        end++;
      }

      // คำนวณ r_ij ตามสมการ (3.3)
      const avgRank = (pos + 1 + end) / 2;

      // ที่พักในกลุ่มค่าเท่ากันได้รับอันดับเฉลี่ยเดียวกัน
      for (let k = pos; k < end; k++) {
        rankMap[c.key][sorted[k].i] = avgRank;
      }

      pos = end;
    }
  });
// ── Step 4 สมการ (3.4) RS_i = Σ_j=1^n (W_j × r_ij)
  const scored = enriched.map((d, i) => {
    const rankSum = CRITERIA.reduce(
      (sum, c) => sum + normW[c.key] * rankMap[c.key][i],
      0
    );

    // เก็บรายละเอียดไว้แสดงใน popup
    const calcDetails = CRITERIA.map(c => ({
      key:            c.key,
      label:          c.label,
      surveyWeight:   SURVEY_WEIGHTS[c.key] ?? 1, // WS_j
      userWeight:     userW[c.key] ?? 1,          // WU_j
      combinedWeight: combined[c.key],           // WS_j × WU_j
      normWeight:     normW[c.key],              // W_j: สมการ (3.2)
      rank:           rankMap[c.key][i],         // r_ij: สมการ (3.3)
      weightedRank:   normW[c.key] * rankMap[c.key][i],
      // weightedRank คือหนึ่งพจน์ W_j × r_ij ในสมการ (3.4)
    }));

    return {
      ...d,
      _rankSum: rankSum, // RS_i จากสมการ (3.4)
      _calcDetails: calcDetails
    };
  });


  // อาจารย์ศรัณย์  แสดงผลเพื่อตรวจสอบ ไม่ใช่ส่วนของสมการ 
  const myresult = Object.entries(rankMap);
  console.log("myresult");
  console.log(myresult);

   // ── Step 5 เตรียมค่าประกอบสมการ (3.5) แปลง rank sum → score 0–100 //
  const sums = scored.map(d => d._rankSum);
  const minRS = Math.min(...sums); // RS_min
  const maxRS = Math.max(...sums); // RS_max

  // หาก RS_max = RS_min ให้ใช้ตัวหาร 1 เพื่อไม่ให้หารด้วย 0
  // กรณีนี้โค้ดจะให้ทุกแห่งได้ 100 คะแนน
  const range = maxRS - minRS || 1;

  console.log("scored");
  console.log(scored);

  return scored
    .map(d => ({
      ...d,

    // แปลง Rank Sum เป็นคะแนน 0–100
    mcaScore: Math.round(
      100 - ((d._rankSum - minRS) / range) * 100
    ),

    _calcMeta: { minRS, maxRS, range },
  }))

  // คะแนนสูงกว่า = ดีกว่า
  // ถ้าคะแนนเท่ากัน ใช้ RS ต่ำกว่าเป็นตัวตัดสิน
  .sort((a, b) =>
    (b.mcaScore - a.mcaScore) ||
    (a._rankSum - b._rankSum)
  )

  // กำหนดอันดับสุดท้าย
  .map((d, i) => ({
    ...d,
    rank: i + 1
  }));
}


//-----------------------จบการคำนวณ----------------------------------//



// ═══════════════════════════════════════════════════════════
//  NEW: RENDER CALCULATION DETAILS — โชว์ในปุ่ม "!" ของ popup หอพัก
// ═══════════════════════════════════════════════════════════
function renderCalcDetailsHTML(d) {

  
  if (!d._calcDetails || !d._calcMeta) return "";

  const rows = d._calcDetails.map(c => `
    <tr>
      <td style="text-align:left">${c.label}</td>
      <td>${c.surveyWeight.toFixed(4)}</td>
      <td>${c.userWeight}</td>
      <td>${c.combinedWeight.toFixed(4)}</td>
      <td>${c.normWeight.toFixed(4)}</td>
      <td>${c.rank}</td>
      <td>${c.weightedRank.toFixed(4)}</td>
    </tr>
  `).join("");

  const { minRS, maxRS, range } = d._calcMeta;

  return `
    <details class="calc-details">
      <summary class="calc-info-btn">ดูวิธีคำนวณคะแนน</summary>
      <div class="calc-details-body">
        <table class="calc-table">
          <thead>
            <tr>
              <th>ปัจจัย</th><th>W.สำรวจ</th><th>W.ผู้ใช้</th>
              <th>W.รวม</th><th>W.นอร์มัล</th><th>Rank</th><th>W.Rank</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="calc-summary">
          Rank-Sum = Σ(W.นอร์มัล × Rank) = <b>${d._rankSum.toFixed(4)}</b><br>
          Rank-Sum ต่ำสุด = ${minRS.toFixed(4)}, สูงสุด = ${maxRS.toFixed(4)}<br>
          Final Score = round(100 − ((${d._rankSum.toFixed(4)} − ${minRS.toFixed(4)}) / ${range.toFixed(4)}) × 100)
          = <b>${d.mcaScore} / 100</b>
        </div>
      </div>
    </details>
  `;
}


// ═══════════════════════════════════════════════════════════
//  สีตาม MCA score
// ═══════════════════════════════════════════════════════════
function scoreToColor(score) {
  if (score >= 80) return "#15803d";  // ดีเยี่ยม
  if (score >= 60) return "#a16207";  // ดี
  if (score >= 40) return "#c2410c";  // ปานกลาง
  return "#b91c1c";                   // ต่ำ
}

// เลขกลุ่มสีของคะแนน (1 = เขียว, 2 = เหลือง, 3 = ส้ม, 4 = แดง)
function tierOf(score) {
  return score >= 80 ? 1 : score >= 60 ? 2 : score >= 40 ? 3 : 4;
}

// สีเข้มขึ้น ใช้กับตัวอักษร/วงกลมอันดับ (สีเหลืองสดอ่านยากบนพื้นขาว)
function scoreToDarkColor(score) {
  if (score >= 80) return "#15803d";
  if (score >= 60) return "#a16207";
  if (score >= 40) return "#c2410c";
  return "#b91c1c";
}

// ระยะทางถึงคณะที่เลือก (เมตร) หรือ null ถ้ายังไม่ได้เลือกคณะ
function getFacultyDist(d) {
  if (!selectedFacultyKey || !facultyDistanceField[selectedFacultyKey]) return null;
  const v = d[facultyDistanceField[selectedFacultyKey]];
  return (v != null && !isNaN(v)) ? v : null;
}

function formatDist(m) {
  return m < 1000 ? `${Math.round(m)} ม.` : `${(m / 1000).toFixed(1)} กม.`;
}

// แถบสรุปเงื่อนไขบนแผนที่
function updateSummaryBar() {
  const bar = document.getElementById("summaryBar");
  if (!bar) return;
  const sel = document.getElementById("facultySelect");
  const facText = sel.value ? sel.options[sel.selectedIndex].text : "ยังไม่ได้เลือกคณะ";
  bar.innerHTML =
    `<div class="sum-line"><i class="ti ti-school"></i> ${facText} <span class="sum-edit">แก้ไข</span></div>`;
}

// ── หมุดที่ใส่เลขอันดับ (จำนวนอันดับแรกที่จะโชว์เลข) ──
const TOP_PIN_COUNT = 999;

// ── ข้อความป้ายจุดเด่น แยกตามปัจจัย ──
const CRITERIA_TAGS = {
  price:     "ราคาถูก",
  distance:  "ใกล้คณะ",
  bathroom:  "ห้องน้ำส่วนตัว",
  food:      "ใกล้ร้านอาหาร",
  cvs:       "ใกล้ 7-11",
  amenity:   "สิ่งอำนวยความสะดวกครบ",
  occupants: "ห้องไม่แออัด",
  park:      "ใกล้สวนสาธารณะ",
  hospital:  "ใกล้โรงพยาบาล",
  transport: "ใกล้จุดรอรถ Shuttle",
  entertain: "ใกล้แหล่งบันเทิง",
};

// จุดเด่น = ปัจจัยที่หอนี้อยู่ใน 1 ใน 3 แรกของทุกหอที่ผ่านตัวกรอง (เลือกไม่เกิน 3 อย่าง)
function getStrengthTags(d, total) {
  if (!d._calcDetails || total < 3) return [];
  return d._calcDetails
    .map(c => ({ key: c.key, pct: c.rank / total, w: c.normWeight }))
    .filter(c => c.pct <= 0.33)
    .sort((a, b) => a.pct - b.pct || b.w - a.w)
    .slice(0, 3)
    .map(c => CRITERIA_TAGS[c.key]);
}

// ═══════════════════════════════════════════════════════════
//  ROOM TYPE INFO — ป้ายห้องพัดลม/แอร์ + คำแนะนำห้องอีกแบบ
//  อิงจาก air_con (ประเภทห้องที่ราคานี้) + Other_type จริง
//  (Other_type = true → หอนี้มีห้องอีกแบบให้เลือกเพิ่มเติมด้วย)
// ═══════════════════════════════════════════════════════════
function renderRoomTypeInfo(d) {
  const badge = d.air_con
    ? `<span class="room-badge ac">ห้องแอร์</span>`
    : `<span class="room-badge fan">ห้องพัดลม</span>`;

  const hint = d.Other_type
    ? (d.air_con
        ? `<div class="room-hint"><i class="ti ti-info-circle"></i>ที่พักนี้มีราคาห้องพัดลมให้เลือกเพิ่มเติม</div>`
        : `<div class="room-hint"><i class="ti ti-info-circle"></i>ที่พักนี้มีราคาห้องแอร์ให้เลือกเพิ่มเติม</div>`)
    : "";

  return { badge, hint };
}

// เนื้อหา popup ของหอพัก
function buildDormPopup(d, roadDist, shownCount, totalCount) {
  const dark = scoreToDarkColor(d.mcaScore);
  const tags = getStrengthTags(d, totalCount);
  const dist = v => (v != null && !isNaN(v)) ? formatDist(v) : "-";

  // เบอร์โทร: รองรับหลายเบอร์คั่นด้วย , หรือ /
  const phones = String(d.phone ?? "")
    .split(/[,/]/)
    .map(p => p.trim())
    .filter(Boolean);
  const phoneHTML = phones.map(p =>
    `<a class="pop-call" href="tel:${p.replace(/[^\d+]/g, "")}"><i class="ti ti-phone"></i> โทร ${p}</a>`
  ).join("");

  // รูป: ถ้าไฟล์หาไม่เจอ รูปจะถูกลบ แล้วเห็นพื้นเทาพร้อมไอคอนแทน
  const photoHTML = d.photo
    ? `<img src="${encodeURI(d.photo)}" alt="" loading="lazy" onerror="this.remove()">`
    : "";

  // ป้ายห้อง + คำแนะนำห้องอีกแบบ (ดูรายละเอียดที่ renderRoomTypeInfo ด้านบน)
  const { badge: roomTypeHTML, hint: roomHintHTML } = renderRoomTypeInfo(d);

  return `
    <div class="dorm-pop">
      <div class="pop-hero">
        <i class="ti ti-building pop-hero-ph"></i>
        ${photoHTML}
        <span class="pop-rank">อันดับ ${d.rank} จาก ${shownCount}</span>
        <div class="pop-score" style="background:${dark}">${d.mcaScore}<small>/ 100</small></div>
      </div>
      <div class="pop-body">
        <div class="pop-name">${d.name_e ?? "-"}</div>
        ${renderAmenityIcons(d)}
        ${renderAmenityAlert(d)}
        ${tags.length
          ? `<div class="pop-tags">${tags.map(t => `<span class="info-chip">${t}</span>`).join("")}</div>`
          : ""}
        <div class="route-info"></div>
        <div class="pop-rows">
          <div><span><i class="ti ti-coin"></i>ราคา</span><b>${d.price_min?.toLocaleString() ?? "-"} บาท/เดือน ${roomTypeHTML}</b></div>
          ${roomHintHTML}
          <div><span><i class="ti ti-map-pin"></i>ระยะถึงคณะ</span><b>${dist(roadDist)}</b></div>
          <div><span><i class="ti ti-tools-kitchen-2"></i>ร้านอาหารใกล้สุด</span><b>${dist(d.restaurantmin_min)}</b></div>
          <div><span><i class="ti ti-building-store"></i>7-11 ใกล้สุด</span><b>${dist(d.storemin_min)}</b></div>
        </div>
        ${phoneHTML}
        ${renderCalcDetailsHTML(d)}
      </div>
    </div>
  `;
}

// กดที่แถบสรุปแล้วไม่ให้ไปโดนแผนที่ด้านหลัง
L.DomEvent.disableClickPropagation(document.getElementById("summaryBar"));


// ═══════════════════════════════════════════════════════════
//  CREATE MAP
// ═══════════════════════════════════════════════════════════
// ── Base Maps ───────────────────────────────────────────
const baseMaps = {
  "OpenStreetMap":     
     L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 
      { attribution: "© OpenStreetMap" }),
  "Esri WorldImagery": 
     L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", 
      { attribution: "© Esri" }),
};
const map = L.map("map").setView([16.4765, 102.8250], 14);
baseMaps["OpenStreetMap"].addTo(map);


// ── POI Layer Groups ────────────────────────────────────
const foodLayer      = L.layerGroup();
const cvsLayer       = L.layerGroup();
const entertainLayer = L.layerGroup();
const hospitalLayer = L.layerGroup();
const transportLayer = L.layerGroup();

const poiConfig = {
  food:      { file: "data_new/restaurant.geojson",  color: "#e67e22", label: "ร้านอาหาร", layer: foodLayer,      icon: "ti-tools-kitchen-2" },
  cvs:       { file: "data_new/store.geojson",        color: "#27ae60", label: "7-Eleven",  layer: cvsLayer,     icon: "ti-building-store" },
  entertain: { file: "data_new/entertain.geojson",    color: "#8e44ad", label: "บันเทิง",   layer: entertainLayer, icon: "ti-music" },
  hospital:  { file: "data_new/hospital.geojson",     color: "#e74c3c", label: "โรงพยาบาล", layer: hospitalLayer, icon: "ti-first-aid-kit" },
  transport: { file: "data_new/busstop.geojson", color: "#3498db", label: "Shuttle Bus", layer: transportLayer, icon: "ti-bus" },
};

Object.entries(poiConfig).forEach(([key, cfg]) => {
  fetch(cfg.file)
    .then(r => r.json())
    .then(data => {
      L.geoJSON(data, {
        pointToLayer: (feature, latlng) =>
          L.marker(latlng, {
            icon: L.divIcon({
            className: "poi-icon",
            html: `<div class="poi-badge" style="color:${cfg.color}"><i class="ti ${cfg.icon}"></i></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            popupAnchor: [0, -11],
          }),
          }),
        onEachFeature: (feature, layer) => {
          layer.bindPopup(`
            <div style="font-family:Sarabun,sans-serif">
              <b>${feature.properties.name ?? cfg.label}</b><br>
              <small style="color:#666">${cfg.label}</small>
            </div>
          `);
        },
      }).addTo(cfg.layer);
    })
    .catch(e => console.error(`โหลด ${key} ไม่ได้:`, e));
});

// ── Overlay Maps ────────────────────────────────────────
const overlayMaps = {};
Object.values(poiConfig).forEach(cfg => {
  overlayMaps[`<span class="ov-badge" style="color:${cfg.color}"><i class="ti ${cfg.icon}"></i></span> ${cfg.label}`] = cfg.layer;
});

// ── Layer Control (icon ซ้อนกันบนแผนที่) ───────────────
L.control.layers(baseMaps, overlayMaps, {
  position:  "topright",
  collapsed: true,
}).addTo(map);

// แปลงชื่อคณะให้เป็นรูปแบบเดียวกัน: ตัวพิมพ์เล็ก + ไม่มีช่องว่าง ───────────────
function normalizeFacKey(k) {
  return String(k ?? "").toLowerCase().replace(/\s+/g, "");
}

// ═══════════════════════════════════════════════════════════
//  LOAD FACULTY DATA
// ═══════════════════════════════════════════════════════════
fetch("data_new/kku_university.geojson")
  .then(res => res.json())
  .then(data => {
    data.features.forEach(f => {
      const key = normalizeFacKey(f.properties.fac_code);
      faculties[key] = {
        name: f.properties.Fac_nm_t,
        lat:  f.properties.latitude,
        lng:  f.properties.longitude,
      };
    });
    console.log("faculties loaded:", Object.keys(faculties).length);
  });


// ═══════════════════════════════════════════════════════════
//  LOAD BUFFER
// ═══════════════════════════════════════════════════════════
fetch("data_new/buffer1.5.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: {
        color:       "#ff7800",
        weight:      2,
        fillColor:   "#ff7800",
        fillOpacity: 0.15,
      },
    }).addTo(map);
  });


// ═══════════════════════════════════════════════════════════
//  LOAD HOUSING DATA
// ═══════════════════════════════════════════════════════════
fetch("data_new/dorm_complete.geojson")
  .then(res => res.json())
  .then(data => {
    dorms = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
    updateMap();
  });


// ═══════════════════════════════════════════════════════════
//  HOUSING TYPE FILTER
// ═══════════════════════════════════════════════════════════
function setHousingType(type) {
  selectedHousingType = type;
  updateMap();
}

function setGenderType(type) {
  selectedGenderType = type;
  updateMap();
}


// ═══════════════════════════════════════════════════════════
//  UPDATE MAP  ← ฟังก์ชันหลัก เรียกทุกครั้งที่ filter เปลี่ยน
// ═══════════════════════════════════════════════════════════
function updateMap() {
  if (dormLayer) map.removeLayer(dormLayer);
  markersByRank = {};   // ล้างของเก่า กันเลขอันดับเก่าค้าง

  const isMobile = window.innerWidth <= 700; 
  const popupMin = isMobile ? 240 : 420;
  const popupMax = isMobile ? Math.min(300, window.innerWidth - 40) : 480;

  // เก็บรายการสิ่งอำนวยความสะดวกที่ผู้ใช้ติ๊กไว้ (ใช้เตือนสีแดงใน popup ไม่ใช้กรอง)
  requestedAmenities = Array.from(
    document.querySelectorAll(".amenity-grid input[type=checkbox]:checked")
  ).map(c => c.value);

  // 1. กรองประเภท / เพศ / ที่จอดรถ
  let filtered = dorms.filter(d => {
    if (selectedHousingType !== "all" && d.type !== selectedHousingType) return false;
    if (d.gender_typ !== selectedGenderType) return false;
    if (document.getElementById("filterCar").checked  && d.pk_car  !== true) return false;
    if (document.getElementById("filterMoto").checked && d.pk_moto !== true) return false;
    return true;
  });

  // 2. คำนวณ MCA
  const allResults = computeRankSumMCA(filtered);

  // 3. กรองราคา
  const [pMin, pMax] = priceSlider.noUiSlider.get().map(Number);
  const results = allResults.filter(d =>
    d.price_min >= pMin && d.price_min <= pMax
  );

    // นับอันดับใหม่ 1..N ตามรายการที่แสดง 
    // (คะแนนยังคิดจากทุกหอที่ผ่านตัวกรอง ไม่เปลี่ยน)
  results.forEach((d, i) => { d.rank = i + 1; });
  updateSummaryBar(results.length);

  // 4. วาง marker บนแผนที่
  dormLayer = L.layerGroup();

  results.forEach(d => {
    const color = scoreToColor(d.mcaScore);

    let roadDist = null;
    if (selectedFacultyKey && facultyDistanceField[selectedFacultyKey]) {
      roadDist = d[facultyDistanceField[selectedFacultyKey]];
    }

        let marker;
      if (d.rank <= TOP_PIN_COUNT) {
      // หมุดวงกลมมีเลขอันดับ
      marker = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: "rank-pin-wrap",
          html: `<div class="rank-pin" style="background:${scoreToDarkColor(d.mcaScore)}">${d.rank}</div>`,
          iconSize:    [26, 26],
          iconAnchor:  [13, 13],
          popupAnchor: [0, -13],
        }),
        zIndexOffset: 1000 - d.rank,     // อันดับต้น ๆ อยู่บนสุด
      });
    } else {
      marker = L.circleMarker([d.lat, d.lng], {
        radius:      9,
        fillColor:   color,
        color:       "#fff",
        weight:      1.5,
        fillOpacity: 0.9,
      });
    }

       marker.bindPopup(
      buildDormPopup(d, roadDist, results.length, allResults.length),
      { maxWidth: popupMax, minWidth: popupMin }
    );

    // ตอนกางตารางวิธีคำนวณ ให้ popup ปรับขนาด/ตำแหน่งตาม
    marker.on("popupopen", e => {
      const det = e.popup.getElement()?.querySelector("details.calc-details");
      if (det) det.addEventListener("toggle", () => e.popup.update());
    });

  function openDormMarker() {
    // เลื่อนเฉพาะแผงอันดับ 
    const el   = document.getElementById(`rank-item-${d.rank}`);
    const list = document.getElementById("ranking");
    if (el && list) {
      const top = list.scrollTop + el.getBoundingClientRect().top
                - list.getBoundingClientRect().top
                - (list.clientHeight - el.offsetHeight) / 2;
      list.scrollTo({ top, behavior: "smooth" });
    }
    marker.openPopup();
    showRoute(d);
  }

  marker.on("click", openDormMarker);
  marker._openDorm = openDormMarker;

  markersByRank[d.rank] = marker;   // ← เพิ่ม ลองรัน
  marker._tier = tierOf(d.mcaScore);  // หมุดนี้สีอะไร
  marker._rank = d.rank;              // อันดับ (ใช้หาการ์ดคู่กัน)

    marker.addTo(dormLayer);
  });

    dormLayer.addTo(map);
  if (facultyMarker) facultyMarker.addTo(map);




    // ── 5. เก็บข้อมูลล่าสุดไว้ให้ป๊อปอัพแบบสอบถามใช้ ──────
  window.latestTop5Dorms   = results.slice(0, 5).map(d => 
    ({ name: d.name_e || "-", score: d.mcaScore }));
  window.latestHousingType = selectedHousingType;
  window.latestGenderType  = selectedGenderType;
  window.latestFaculty     = selectedFacultyKey;
  window.latestPriceRange  = priceSlider.noUiSlider.get().map(Number);

  // ── 6. แสดง ranking panel ─────────────────────────────────
  renderRanking(results);
  applyLegendFilter();   // คงสีที่กรองไว้ แม้กดคำนวณใหม่
}


// ═══════════════════════════════════════════════════════════
//  RENDER RANKING PANEL (ด้านขวา)
// ═══════════════════════════════════════════════════════════

function renderRanking(results) {
  const container = document.getElementById("ranking");
  if (!container) return;

  const cnt = document.getElementById("resultCount");
  if (cnt) cnt.textContent = `พบ ${results.length} แห่ง`;

  if (results.length === 0) {
    container.innerHTML = `<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px">
      ไม่พบหอพักที่ตรงเงื่อนไข</p>`;
    return;
  }

  container.innerHTML = results.map(d => {
    const color = scoreToColor(d.mcaScore);       // สีแถบคะแนน
    const dark  = scoreToDarkColor(d.mcaScore);   // สีวงกลม/ตัวเลข
    const dist  = getFacultyDist(d);
    return `
      <div class="rank-card" id="rank-item-${d.rank}"
           onclick="zoomToDorm(${d.rank})">
        <div class="rank-row">
          <div class="rank-badge" style="background:${dark}">${d.rank}</div>
          <div class="rank-info">
            <div class="rank-name">${d.name_e ?? "-"}</div>
            <div class="rank-chips">
              <span class="info-chip">฿${d.price_min?.toLocaleString() ?? "-"}</span>
              ${dist != null ? `<span class="info-chip"><i class="ti ti-map-pin"></i> ${formatDist(dist)}</span>` : ""}
            </div>
          </div>
          <span class="rank-score-num" style="color:${dark}">${d.mcaScore}</span>
        </div>
        <div class="score-bar-wrap">
          <div class="score-bar-fill" style="width:${d.mcaScore}%;background:${color}"></div>
        </div>
      </div>
    `;
  }).join("");
}


// ═══════════════════════════════════════════════════════════
//  ZOOM TO DORM เมื่อคลิกที่ ranking card
// ═══════════════════════════════════════════════════════════ ** ลองรันนน
function zoomToDorm(rank) {
  const marker = markersByRank[rank];
  if (!marker) return;
  // ไปที่หมุดก่อน (ไม่ใช้ animation จะได้ไม่ต้องรอ) ถ้ายังไม่ได้เลือกคณะจะอยู่ที่ระดับนี้
  map.setView(marker.getLatLng(), 16, { animate: false });
  fitRouteNext = true;                    // ให้ showRoute ปรับมุมมองให้เห็นทั้งเส้นทาง
  if (marker._openDorm) marker._openDorm();
}

// ═══════════════════════════════════════════════════════════
//  SELECT FACULTY
// ═════════════════════cc══════════════════════════════════════
function selectFaculty() {
  const selected = normalizeFacKey(document.getElementById("facultySelect").value);
selectedFacultyKey = selected;

  const faculty = faculties[selected];
  if (!faculty) return;

  if (facultyMarker) map.removeLayer(facultyMarker);

   facultyMarker = L.marker([faculty.lat, faculty.lng], {
    icon: L.divIcon({
      className: "fac-pin-wrap",
      html: `<div class="fac-pin"><i class="ti ti-school"></i></div>`,
      iconSize:   [36, 44],
      iconAnchor: [18, 44],
    }),
    zIndexOffset: 2000,
  }).bindTooltip(faculty.name, {
    permanent: true, direction: "top", offset: [0, -46], className: "fac-label",
  });

  map.setView([faculty.lat, faculty.lng], 16);
  updateMap();
}


// ═══════════════════════════════════════════════════════════
//  PRICE SLIDER (noUiSlider)
// ═══════════════════════════════════════════════════════════
const priceSlider = document.getElementById("priceSlider");

noUiSlider.create(priceSlider, {
  start:   [1500, 4500],
  connect: true,
  step:    100,
  tooltips: true,
  range: { min: 0, max: 10000 },
  format: {
    to:   v => Math.round(v),
    from: v => Number(v),
  },
});

priceSlider.noUiSlider.on("update", ([min, max]) => {
  document.getElementById("priceMin").textContent = Number(min).toLocaleString();
  document.getElementById("priceMax").textContent = Number(max).toLocaleString();
});


// ═══════════════════════════════════════════════════════════
//  PRICE QUICK-SELECT BUTTONS
// ═══════════════════════════════════════════════════════════
function selectPriceChip(el, min, max) {
  document.querySelectorAll(".price-chip, .price-box")
    .forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  priceSlider.noUiSlider.set([min, max]);
}

// ═══════════════════════════════════════════════════════════
//  DRAWER (มือถือ) — เปิด/ปิดลิ้นชักตัวกรอง
// ═══════════════════════════════════════════════════════════
function toggleDrawer(force) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("drawerOverlay");
  const open = (typeof force === "boolean") ? force : !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", open);
  overlay.classList.toggle("show", open);
  document.getElementById("filterToggle").setAttribute("aria-expanded", String(open));
}

// ═══════════════════════════════════════════════════════════
//  ปุ่มคำนวณ MCA
// ═══════════════════════════════════════════════════════════

function calculateMCA() {
  updateMap();                                        // คำนวณ + อัปเดตแผนที่
  document.body.classList.add("has-results");         // โชว์แผงอันดับ
  toggleDrawer(false); 
  document.getElementById("surveyInvite")
  .classList.toggle("available", window.latestTop5Dorms.length > 0);
  setTimeout(() => map.invalidateSize(), 400);        // แผนที่เปลี่ยนขนาด ต้องคำนวณใหม่
}

function openSurvey() {
  document.getElementById("surveyFrame").contentWindow?.openSurvey?.();
}

// กด Esc เพื่อปิดป๊อปอัป
document.addEventListener("keydown", e => {
  if (e.key === "Escape") toggleDrawer(false);
});

// หมุนจอ/ย่อขยายหน้าต่าง ให้แผนที่คำนวณขนาดใหม่
window.addEventListener("resize", () => map.invalidateSize());

// รองรับ setPriceRange() ที่อาจเรียกจากที่อื่น
window.setPriceRange = function(min, max) {
  priceSlider.noUiSlider.set([min, max]);
};


// ═══════════════════════════════════════════════════════════
//  RESET ALL
// ═══════════════════════════════════════════════════════════
function resetAll() {
  // reset dropdowns
  document.getElementById("facultySelect").value = "";
  document.querySelectorAll("select").forEach(s => {
    if (s.id !== "facultySelect") s.selectedIndex = 0;
  });

  // reset dropdowns
  selectedGenderType = "both";
  document.getElementById("genderSelect").selectedIndex = 0;

  // reset checkboxes
  document.querySelectorAll("input[type=checkbox]")
    .forEach(c => c.checked = false);

  // reset range sliders → ค่า default 3
  document.querySelectorAll("input[type=range]").forEach(r => {
    r.value = 3;
    const next = r.nextElementSibling;
    if (next?.classList.contains("weight-val")) next.textContent = "3";
  });

  // reset price chips
  document.querySelectorAll(".price-chip, .price-box")
    .forEach(b => b.classList.remove("active"));
  priceSlider.noUiSlider.set([1500, 4500]);

  // reset faculty marker
  if (facultyMarker) { map.removeLayer(facultyMarker); facultyMarker = null; }
  selectedFacultyKey = null;
  selectedHousingType = "all";

 clearRoute();
 
  updateMap();
}

// ═══════════════════════════════════════════════════════════
//  ROUTING — แสดงเส้นทางจากหอพัก → คณะ (OSRM)
// ═══════════════════════════════════════════════════════════
let routeLayer = null;
let routePopup = null;
let fitRouteNext = false;   // true = ครั้งหน้าที่วาดเส้นทาง ให้ปรับมุมมองให้เห็นทั้งเส้น

function clearRoute() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  if (routePopup) { map.removeLayer(routePopup); routePopup = null; }  
}

// เพิ่มชี showToast("กรุณาเลือกคณะก่อนค่ะ") เข้ามา แทน   alert("กรุณาเลือกคณะก่อนค่ะ");
function showToast(message) {
  const toast = document.createElement("div");
  toast.innerHTML = `<i class="ti ti-alert-triangle"></i>${message}`;
  toast.className = "app-toast";
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

//อันนี้ๆ
function showRoute(d) {
  const doFit = fitRouteNext;
  fitRouteNext = false;

  if (!selectedFacultyKey || !faculties[selectedFacultyKey]) {
    showToast("กรุณาเลือกคณะก่อนค่ะ");
    return;
  }

  const faculty = faculties[selectedFacultyKey];
  const field   = facultyDistanceField[selectedFacultyKey];   // เช่น "kku_cost"

  let routes = d.routes;
  if (typeof routes === "string") {
    try { routes = JSON.parse(routes); } catch { routes = null; }
  }
  const coords = routes?.[field];

  if (!Array.isArray(coords) || coords.length < 2) {
    clearRoute();
    showToast("ไม่มีข้อมูลเส้นทางของหอนี้");
    return;
  }

  clearRoute();
  routeLayer = L.geoJSON(
    { type: "Feature", geometry: { type: "LineString", coordinates: coords } },
    { style: { color: "#1A3F72", weight: 5, opacity: 0.85 } }
  ).addTo(map);

  if (doFit) {
    const topPad = Math.min(280, Math.round(map.getSize().y * 0.45));
    map.fitBounds(routeLayer.getBounds(), {
      paddingTopLeft:     [40, topPad],
      paddingBottomRight: [60, 60],
      maxZoom: 17,
    });
  }

  // ระยะใช้ค่าเดียวกับที่ใช้คิดคะแนน MCA (หน่วยเมตร)
  const distM = Number(d[field]);
  const info = document.querySelector(".route-info");
  if (info && !isNaN(distM)) {
    info.innerHTML =
      `<i class="ti ti-route"></i> ${(distM / 1000).toFixed(2)} กม. ไป${faculty.name}`;
    if (map._popup) map._popup.update();
  }
}

// ═══════════════════════════════════════════════════════════
//  LEGEND FILTER — กดสีใน legend เพื่อกรองหมุด + การ์ดอันดับ
// ═══════════════════════════════════════════════════════════
const LEGEND_MODE = "solo";   // "solo" | "multi" | "hide"
let legendSel = new Set();    // สีที่เลือก (ว่าง = แสดงทั้งหมด)

function isTierVisible(t) {
  if (LEGEND_MODE === "hide") return !legendSel.has(t);
  return legendSel.size === 0 || legendSel.has(t);
}

function applyLegendFilter() {
  if (!dormLayer) return;
  let shown = 0;
  Object.values(markersByRank).forEach(m => {
    const ok = isTierVisible(m._tier);
    if (ok) {
      if (!dormLayer.hasLayer(m)) dormLayer.addLayer(m);
      shown++;
    } else {
      m.closePopup();
      dormLayer.removeLayer(m);
    }
    const card = document.getElementById(`rank-item-${m._rank}`);
    if (card) card.style.display = ok ? "" : "none";
  });

  document.querySelectorAll(".legend-item[data-tier]").forEach(el => {
    const t = Number(el.dataset.tier);
    el.classList.toggle("off", !isTierVisible(t));
    el.classList.toggle("on", LEGEND_MODE !== "hide" && legendSel.has(t));
  });

  const cnt = document.getElementById("resultCount");
  if (cnt) cnt.textContent = `พบ ${shown} แห่ง`;
}

const legendBox = document.querySelector(".map-legend");
if (legendBox) L.DomEvent.disableClickPropagation(legendBox);

document.querySelectorAll(".legend-item[data-tier]").forEach(el => {
  el.addEventListener("click", () => {
    const t = Number(el.dataset.tier);
    if (LEGEND_MODE === "solo") {
      legendSel = (legendSel.size === 1 && legendSel.has(t)) ? new Set() : new Set([t]);
    } else {
      legendSel.has(t) ? legendSel.delete(t) : legendSel.add(t);
      if (legendSel.size === 4) legendSel.clear();
    }
    applyLegendFilter();
  });
});

console.log("legend filter ready:", document.querySelectorAll(".legend-item[data-tier]").length, "items");


// ═══════════════════════════════════════════════════════════
//  แจ้งเตือนราคา — ขึ้นบนสุดของแผนที่หลังกด "คำนวณคะแนน MCA"
// ═══════════════════════════════════════════════════════════
(function () {
  const mapEl = document.getElementById("map");

  const bar = document.createElement("div");
  bar.id = "priceNotice";
  bar.setAttribute("role", "status");
  bar.innerHTML = `
    <i class="ti ti-alert-triangle"></i>
    <div class="pn-text">
      <b>โปรดตรวจสอบราคากับที่พัก</b>
      ราคาที่แสดงเป็นข้อมูล ณ วันที่สำรวจ และอาจมีการเปลี่ยนแปลง
      กรุณาติดต่อที่พักโดยตรงเพื่อยืนยันราคาปัจจุบัน
    </div>
    <button type="button" class="pn-ok">รับทราบ</button>`;
  mapEl.appendChild(bar);
  L.DomEvent.disableClickPropagation(bar);

  let acknowledged = false;   // กดรับทราบแล้ว = ไม่ขึ้นอีกจนกว่าจะรีโหลด

  // เลื่อนปุ่มซูม/แถบสรุป/แผงหอพักลงตามความสูงแถบ ไม่ให้ถูกบัง
  function setOffset() {
    const h = bar.classList.contains("show") ? bar.offsetHeight : 0;
    mapEl.style.setProperty("--notice-h", h + "px");
  }
  function show() {
    if (acknowledged) return;
    bar.classList.add("show");
    setOffset();
    setTimeout(setOffset, 450);   // มือถือ: แผนที่เปลี่ยนขนาดหลังคำนวณ
  }
  function hide() {
    acknowledged = true;
    bar.classList.remove("show");
    setOffset();
  }

  bar.querySelector(".pn-ok").addEventListener("click", hide);
  window.addEventListener("resize", setOffset);

  // ครอบปุ่มคำนวณเดิม: คำนวณตามปกติ แล้วค่อยแสดงแจ้งเตือน
  const originalCalc = calculateMCA;
  calculateMCA = function () {
    originalCalc.apply(this, arguments);
    show();
  };
})();