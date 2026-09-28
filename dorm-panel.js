// ═══════════════════════════════════════════════════════════
//  DORM PANEL — แสดงรายละเอียดหอพักแทน popup
//  จอคอม : แผงชิดขวาของแผนที่
//  มือถือ: การ์ดเล็กด้านล่างแผนที่ → แตะเพื่อเปิดรายละเอียดเต็มจอ
//  ไฟล์นี้ต้องโหลด "หลัง" script.js เสมอ
// ═══════════════════════════════════════════════════════════
(function () {
  const mapEl = document.getElementById("map");
  const mobileQuery = window.matchMedia("(max-width: 700px)");
  const isMobile = () => mobileQuery.matches;
  let currentHTML = "";

  // ── 1. สร้างองค์ประกอบ ────────────────────────────────
  // (ก) แผงจอคอม — อยู่ในแผนที่
  const panel = document.createElement("div");
  panel.id = "dormPanel";
  panel.innerHTML =
    `<button type="button" class="dorm-panel-close" aria-label="ปิด"><i class="ti ti-x"></i></button>` +
    `<div class="dorm-panel-body"></div>`;
  mapEl.appendChild(panel);
  const panelBody = panel.querySelector(".dorm-panel-body");

  // (ข) การ์ดเล็กมือถือ — อยู่ในแผนที่ ชิดด้านล่าง
  const mini = document.createElement("div");
  mini.id = "dormMini";
  mini.innerHTML = `
    <div class="mini-thumb"><i class="ti ti-building"></i></div>
    <div class="mini-info">
      <div class="mini-name"></div>
      <div class="mini-meta"></div>
      <div class="mini-sub"><span class="mini-rank"></span> · <span class="mini-more">ดูรายละเอียด ›</span></div>
    </div>
    <div class="mini-score"></div>
    <button type="button" class="mini-close" aria-label="ปิด"><i class="ti ti-x"></i></button>`;
  mapEl.appendChild(mini);

  // (ค) หน้ารายละเอียดเต็มจอมือถือ — อยู่ที่ body
  const full = document.createElement("div");
  full.id = "dormFull";
  full.innerHTML = `
    <div class="dorm-full-bar">
      <button type="button" class="dorm-full-back"><i class="ti ti-arrow-left"></i> กลับแผนที่</button>
    </div>
    <div class="dorm-full-body"></div>`;
  document.body.appendChild(full);
  const fullBody = full.querySelector(".dorm-full-body");

  // กด/เลื่อนในแผงแล้วไม่ให้แผนที่ขยับตาม
  [panel, mini].forEach(el => {
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  });

  // ── 2. ปุ่มต่าง ๆ ──────────────────────────────────────
  panel.querySelector(".dorm-panel-close").addEventListener("click", () => closeDormPanel());
  mini.querySelector(".mini-close").addEventListener("click", e => {
    e.stopPropagation();
    closeDormPanel();
  });
  mini.addEventListener("click", () => openFull());
  full.querySelector(".dorm-full-back").addEventListener("click", () => closeFull());

  // ── 3. เติมข้อมูลการ์ดเล็ก (ดึงจากเนื้อหา popup เดิม) ─────
  function fillMini(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const text = sel => tmp.querySelector(sel)?.textContent.trim() ?? "";

    // รูป
    const thumb = mini.querySelector(".mini-thumb");
    thumb.innerHTML = `<i class="ti ti-building"></i>`;
    const img = tmp.querySelector(".pop-hero img");
    if (img) {
      const im = document.createElement("img");
      im.src = img.getAttribute("src");
      im.alt = "";
      im.onerror = () => im.remove();
      thumb.appendChild(im);
    }

    // ชื่อ / อันดับ
    mini.querySelector(".mini-name").textContent = text(".pop-name");
    mini.querySelector(".mini-rank").textContent = text(".pop-rank");

    // ราคา + ระยะถึงคณะ
    const rows = [...tmp.querySelectorAll(".pop-rows > div")];
    const priceRow = rows.find(r => r.textContent.includes("ราคา"));
    const distRow  = rows.find(r => r.textContent.includes("ระยะถึงคณะ"));
    const price = priceRow?.querySelector("b")?.textContent.match(/[\d,]+/)?.[0];
    const dist  = distRow?.querySelector("b")?.textContent.trim();
    const meta = [];
    if (price) meta.push(`฿${price}/เดือน`);
    if (dist && dist !== "-") meta.push(dist);
    mini.querySelector(".mini-meta").textContent = meta.join(" · ");

    // คะแนน (สีเดียวกับหมุด)
    const scoreSrc = tmp.querySelector(".pop-score");
    const score = mini.querySelector(".mini-score");
    score.style.background = scoreSrc?.style.background || "#1A3F72";
    score.innerHTML = `${scoreSrc?.firstChild?.textContent.trim() ?? "-"}<small>/ 100</small>`;
  }

  // ── 4. เปิด / ปิด ──────────────────────────────────────
  window.openDormPanel = function (html, latlng) {
    currentHTML = html;
    if (isMobile()) {
      fillMini(html);
      mini.classList.add("open");
    } else {
      panelBody.innerHTML = html;
      panelBody.scrollTop = 0;
      panel.classList.add("open");
    }
    if (latlng) map.panInside(latlng, getPanelPadding());   // เลื่อนหมุดออกจากใต้แผง/การ์ด
  };

  window.closeDormPanel = function () {
    const wasOpen = panel.classList.contains("open") || mini.classList.contains("open");
    panel.classList.remove("open");
    mini.classList.remove("open");
    closeFull();
    panelBody.innerHTML = "";
    currentHTML = "";
    if (wasOpen) clearRoute();
  };

  function openFull() {
    if (!currentHTML) return;
    fullBody.innerHTML = currentHTML;
    fullBody.scrollTop = 0;
    full.classList.add("open");
  }

  function closeFull() {
    full.classList.remove("open");
    fullBody.innerHTML = "";
  }

  // หมุนจอ/ย่อหน้าต่างข้ามขนาดมือถือ-คอม → ปิดของเดิมกันแสดงผิดที่
  mobileQuery.addEventListener("change", () => closeDormPanel());

  // ── 5. ระยะเว้นขอบ ให้เส้นทางอยู่ในพื้นที่ที่ไม่ถูกบัง ────────
  function getPanelPadding() {
    const pad = 40;
    const m = mapEl.getBoundingClientRect();
    if (isMobile() && mini.classList.contains("open")) {
      const r = mini.getBoundingClientRect();
      const overlap = Math.max(0, Math.round(m.bottom - r.top));
      return { paddingTopLeft: [30, 50], paddingBottomRight: [30, overlap + 20] };
    }
    if (!isMobile() && panel.classList.contains("open")) {
      const p = panel.getBoundingClientRect();
      return { paddingTopLeft: [pad, pad], paddingBottomRight: [Math.round(m.right - p.left) + 20, pad] };
    }
    return { paddingTopLeft: [pad, pad], paddingBottomRight: [pad, pad] };
  }

  // ── 6. เปลี่ยนหมุดหอพักจาก popup → แผง/การ์ด ─────────────
  function convertMarkers() {
    Object.values(markersByRank).forEach(m => {
      const popup = m.getPopup && m.getPopup();
      if (!popup) return;
      const html = popup.getContent();   // ใช้เนื้อหาเดิมจาก buildDormPopup()
      m.unbindPopup();

      const origOpen = m._openDorm;      // ของเดิม: เลื่อนแผงอันดับ + วาดเส้นทาง
      m._openDorm = function () {
        openDormPanel(html, m.getLatLng());
        if (origOpen) origOpen();
      };
      m.off("click");
      m.on("click", m._openDorm);
    });
  }

  // ครอบ updateMap เดิม: ปิดของเก่า → คำนวณ/วาดหมุดตามเดิม → แปลงหมุด
  const originalUpdateMap = updateMap;
  updateMap = function () {
    closeDormPanel();
    originalUpdateMap.apply(this, arguments);
    convertMarkers();
  };

  // ── 7. เส้นทาง: ซูมให้เห็นทั้งเส้นในพื้นที่ที่ไม่ถูกบังทุกครั้ง ──
  showRoute = async function (dormLat, dormLng) {
    fitRouteNext = false;
    if (!selectedFacultyKey || !faculties[selectedFacultyKey]) {
      showToast("กรุณาเลือกคณะก่อนค่ะ");
      return;
    }

    const faculty = faculties[selectedFacultyKey];
    const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/`
      + `${dormLng},${dormLat};${faculty.lng},${faculty.lat}`
      + `?overview=full&geometries=geojson`;

    try {
      const res   = await fetch(url);
      const data  = await res.json();
      const route = data.routes[0];

      clearRoute();
      routeLayer = L.geoJSON(
        { type: "Feature", geometry: route.geometry },
        { style: { color: "#1A3F72", weight: 5, opacity: 0.85 } }
      ).addTo(map);

      map.fitBounds(routeLayer.getBounds(), { ...getPanelPadding(), maxZoom: 17 });
    } catch (e) {
      console.error("Route error:", e);
      showToast("ไม่สามารถโหลดเส้นทางได้");
    }
  };

  // Esc: ปิดหน้าเต็มจอก่อน แล้วค่อยปิดแผง
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (full.classList.contains("open")) closeFull();
    else closeDormPanel();
  });

  // ── 8. ตารางวิธีคำนวณ: หัวตารางภาษาไทย + คำอธิบาย ─────────
  // แสดงผลอย่างเดียว — ใช้ค่าที่คำนวณไว้แล้วใน computeRankSumMCA() ไม่ได้คำนวณใหม่
  renderCalcDetailsHTML = function (d) {
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
                <th>ปัจจัย</th>
                <th>น้ำหนักจาก<br>แบบสอบถาม</th>
                <th>ความสำคัญ<br>ที่ตั้งไว้</th>
                <th>น้ำหนัก<br>รวม</th>
                <th>น้ำหนัก<br>สุดท้าย</th>
                <th>อันดับ<br>ของที่พักนี้</th>
                <th>คะแนน<br>ถ่วงน้ำหนัก</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="6" style="text-align:right">รวม (Rank-Sum)</td>
                <td>${d._rankSum.toFixed(4)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="calc-legend">
            <div><b>น้ำหนักจากแบบสอบถาม</b> ความสำคัญของปัจจัยจากผลสำรวจ</div>
            <div><b>ความสำคัญที่ตั้งไว้</b> ค่า 1–5 ที่ปรับในแผงปรับเงื่อนไข</div>
            <div><b>น้ำหนักรวม</b> = น้ำหนักจากแบบสอบถาม × ความสำคัญที่ตั้งไว้</div>
            <div><b>น้ำหนักสุดท้าย</b> = น้ำหนักรวม ÷ ผลรวมน้ำหนักรวมทุกปัจจัย (รวมกันได้ 1)</div>
            <div><b>อันดับของที่พักนี้</b> ในปัจจัยนั้น เทียบกับทุกที่พักที่ผ่านตัวกรอง (1 = ดีที่สุด)</div>
            <div><b>คะแนนถ่วงน้ำหนัก</b> = น้ำหนักสุดท้าย × อันดับ</div>
          </div>

          <div class="calc-summary">
            <div>① ผลรวมคะแนนถ่วงน้ำหนัก (Rank-Sum) = <b>${d._rankSum.toFixed(4)}</b> <span class="calc-hint">ยิ่งน้อยยิ่งดี</span></div>
            <div>② Rank-Sum ต่ำสุด / สูงสุดของทุกที่พัก = ${minRS.toFixed(4)} / ${maxRS.toFixed(4)}</div>
            <div>③ คะแนนสุดท้าย = 100 − ((${d._rankSum.toFixed(4)} − ${minRS.toFixed(4)}) ÷ ${range.toFixed(4)}) × 100
              = <b>${d.mcaScore} / 100</b></div>
          </div>
        </div>
      </details>
    `;
  };

  // ถ้าข้อมูลหอพักโหลดเสร็จก่อนไฟล์นี้ ให้วาดใหม่ครั้งเดียว (ใช้แผงและตารางแบบใหม่)
  if (dorms.length) updateMap();

  console.log("dorm panel ready");
})();