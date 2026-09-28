// ═══════════════════════════════════════════════════════════
//  ABOUT — ปุ่ม "เกี่ยวกับ" ใน header + ป๊อปอัปข้อมูลผู้จัดทำ
//  แก้ข้อมูลได้ที่ ABOUT_INFO ด้านล่างอย่างเดียว
// ═══════════════════════════════════════════════════════════
const ABOUT_INFO = {
  project:      "KKU Dorm Selection",
  subtitle:     "ระบบสนับสนุนการตัดสินใจเลือกที่พักด้วย MCA",

  courseCode:   "CP374702",          // ← รหัสวิชา
  courseName:   "โครงงานวิจัยในภูมิสารสนเทศศาสตร์ 1",            // ← ชื่อวิชา
  academicYear: "2569",              // ← ปีการศึกษา
  studentYear:  "4",                 // ← ชั้นปี

  members: [                         // ← ชื่อ-นามสกุล + รหัสนักศึกษา
    { name: "นางสาวพิมพ์ชนก ไชยหงษา",   id: "663380430-8" },
    { name: "นางสาวอนันตญา ภักดี",       id: "663380551-6" },
  ],

  advisors:   ["อ.ดร.ศรัณย์ อภิชนตระกูล"],   // ← เพิ่มที่ปรึกษาร่วมได้ คั่นด้วย ,
  department: "หลักสูตรภูมิสารสนเทศศาสตร์",                             // ← ภาควิชา (ถ้าไม่มี ปล่อยว่าง "")
  major:      "สาขาวิชาวิทยาการคอมพิวเตอร์",
  faculty:    "วิทยาลัยการคอมพิวเตอร์",
  university: "มหาวิทยาลัยขอนแก่น",
};

(function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ตัวอักษรในวงกลม: ข้ามสระหน้า (เ แ โ ใ ไ)
  const initial = name => (String(name).replace(/^[เแโใไ]/, "")[0] || "?");

  // ── 1. ปุ่มใน header (วางก่อน "ประเมินระบบ") ─────────────
  const btn = document.createElement("button");
  btn.id = "aboutBtn";
  btn.type = "button";
   btn.innerHTML = `<span class="aboutBtn","ti-users">ผู้จัดทำ</span>`;

  const surveyBtn = document.getElementById("surveyInvite");
  surveyBtn.parentNode.insertBefore(btn, surveyBtn);

  // ── 2. ป๊อปอัป ───────────────────────────────────────
  const I = ABOUT_INFO;
  const members = I.members.map(m => `
    <div class="about-mem">
      <div class="about-av"><i class="ti ti-school"></i></div>
      <div class="about-mem-info">
        <div class="about-mem-name">${esc(m.name)}</div>
        <div class="about-mem-id">${esc(m.id)}</div>
      </div>
    </div>`).join("");

    const orgLines = [I.department, I.major, I.faculty, I.university]
    .filter(Boolean)
    .map(t => `<div>${esc(t)}</div>`)
    .join("");

  const overlay = document.createElement("div");
  overlay.id = "aboutOverlay";
  overlay.innerHTML = `
    <div class="about-box" role="dialog" aria-modal="true" aria-labelledby="aboutTitle">
      <div class="about-head">
        <div id="aboutTitle" class="about-title">${esc(I.project)}</div>
        <div class="about-sub">${esc(I.subtitle)}</div>
        <button type="button" class="about-close" aria-label="ปิด"><i class="ti ti-x"></i></button>
      </div>
      <div class="about-body">
        <div class="about-chips">
          <span class="info-chip"><i class="ti ti-book"></i> ${esc(I.courseCode)} ${esc(I.courseName)}</span>
          <span class="info-chip"><i class="ti ti-calendar"></i> ปีการศึกษา ${esc(I.academicYear)}</span>
        </div>
        <div class="about-sec">ผู้จัดทำ · นักศึกษาชั้นปีที่ ${esc(I.studentYear)}</div>
        <div class="about-grid">${members}</div>
        <div class="about-foot">
          <div><b>อาจารย์ที่ปรึกษา</b> ${I.advisors.map(esc).join(", ")}</div>
          ${orgLines}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // ── 3. เปิด / ปิด ───────────────────────────────────
  const open  = () => overlay.classList.add("show");
  const close = () => overlay.classList.remove("show");
  window.openAbout = open;
  window.closeAbout = close;

  btn.addEventListener("click", open);
  overlay.querySelector(".about-close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });   // กดพื้นที่เบลอ = ปิด
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();


// ═══════════════════════════════════════════════════════════
//  ปุ่มใน header: ไอคอน + คำ (มือถือใช้คำสั้น) เปลี่ยนข้างบน เทสก่อน 
// ═══════════════════════════════════════════════════════════
(function () {
  function setHeaderBtn(id, icon, fullText, shortText) {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerHTML =
      `<i class="ti ${icon}"></i>` +
      `<span class="hb-full">${fullText}</span>` +
      `<span class="hb-short">${shortText}</span>`;
  }
  setHeaderBtn("aboutBtn",     "ti-users",                   "ผู้จัดทำ",    "ผู้จัดทำ");
  setHeaderBtn("surveyInvite", "ti-message-circle-question", "ประเมินระบบ", "ประเมิน");
  setHeaderBtn("filterToggle", "ti-adjustments-horizontal",  "ปรับเงื่อนไข", "เงื่อนไข");
})();
