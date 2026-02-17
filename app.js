const totalSteps = 7;
const form = document.getElementById("receptionForm");
const result = document.getElementById("result");
const stepNumber = document.getElementById("stepNumber");
const progressBar = document.getElementById("progressBar");

const reservationDb = [
  { code: "RZV1001", phone: "+905551112233", ids: ["12345678901", "P1234567"] },
  { code: "RZV2002", phone: "+905444556677", ids: ["98765432100", "U7654321"] },
];

const roomInventory = {
  Standart: ["201", "202", "203", "204"],
  Deluxe: ["301", "302", "303"],
  Suit: ["401", "402"],
};

let state = {
  step: 1,
  hasReservation: null,
  reservationCode: "",
  guestCount: 1,
  checkoutDate: "",
  guests: [],
  roomType: "Standart",
  assignedRoom: "",
  card: {},
  qrPayload: "",
};

function render() {
  stepNumber.textContent = state.step;
  progressBar.style.width = `${(state.step / totalSteps) * 100}%`;
  result.classList.add("hidden");
  result.innerHTML = "";

  if (state.step === 1) return renderStep1();
  if (state.step === 2) return renderStep2();
  if (state.step === 3) return renderStep3();
  if (state.step === 4) return renderStep4();
  if (state.step === 5) return renderStep5();
  if (state.step === 6) return renderStep6();
  return renderStep7();
}

function navButtons(nextText = "Devam") {
  return `<div class="nav">
    <button type="button" class="btn-secondary" ${state.step === 1 ? "disabled" : ""} onclick="prevStep()">Geri</button>
    <button type="submit" class="btn-primary">${nextText}</button>
  </div>`;
}

function renderStep1() {
  form.innerHTML = `
    <div class="grid">
      <div class="field">
        <label>Rezervasyonunuz var mı?</label>
        <select name="hasReservation" required>
          <option value="">Seçiniz</option>
          <option value="yes" ${state.hasReservation === true ? "selected" : ""}>Evet</option>
          <option value="no" ${state.hasReservation === false ? "selected" : ""}>Hayır</option>
        </select>
      </div>
      <p class="helper">Adım 1: Rezervasyon durumuna göre akış otomatik şekillenir.</p>
    </div>
    ${navButtons()}
  `;

  form.onsubmit = (e) => {
    e.preventDefault();
    const value = new FormData(form).get("hasReservation");
    if (!value) return;
    state.hasReservation = value === "yes";
    state.step = 2;
    render();
  };
}

function buildGuestFields(count, includeDetails) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const guest = state.guests[i] || {};
    parts.push(`
      <div class="card" style="padding:0.9rem; border:1px solid #e2e8f0; box-shadow:none; border-radius:12px;">
        <strong>${i + 1}. Misafir</strong>
        <div class="grid two" style="margin-top:0.6rem;">
          <div class="field">
            <label>Uyruk</label>
            <select name="nationality_${i}" required>
              <option value="TC" ${guest.nationality === "TC" ? "selected" : ""}>TC Vatandaşı</option>
              <option value="FOREIGN" ${guest.nationality === "FOREIGN" ? "selected" : ""}>Yabancı</option>
            </select>
          </div>
          <div class="field">
            <label>TC Kimlik / Pasaport No</label>
            <input name="identity_${i}" placeholder="11 haneli TC veya Pasaport" value="${guest.identity || ""}" required />
          </div>
          ${includeDetails ? `
          <div class="field">
            <label>Ad Soyad</label>
            <input name="name_${i}" value="${guest.name || ""}" required />
          </div>
          <div class="field">
            <label>Doğum Tarihi</label>
            <input type="date" name="dob_${i}" value="${guest.dob || ""}" required />
          </div>
          <div class="field">
            <label>Telefon</label>
            <input name="phone_${i}" placeholder="+90..." value="${guest.phone || ""}" required />
          </div>
          ` : ""}
        </div>
      </div>
    `);
  }
  return parts.join("");
}

function collectGuests(count, includeDetails) {
  const data = new FormData(form);
  const guests = [];
  for (let i = 0; i < count; i++) {
    const nationality = data.get(`nationality_${i}`);
    const identity = (data.get(`identity_${i}`) || "").toString().trim();
    if (nationality === "TC" && !/^\d{11}$/.test(identity)) {
      throw new Error(`${i + 1}. misafir için TC kimlik numarası 11 haneli olmalıdır.`);
    }
    if (nationality === "FOREIGN" && identity.length < 6) {
      throw new Error(`${i + 1}. misafir için pasaport no geçersiz.`);
    }
    const guest = { nationality, identity };
    if (includeDetails) {
      guest.name = (data.get(`name_${i}`) || "").toString().trim();
      guest.dob = data.get(`dob_${i}`);
      guest.phone = (data.get(`phone_${i}`) || "").toString().trim();
    }
    guests.push(guest);
  }
  return guests;
}

function showError(message) {
  const old = form.querySelector(".error");
  if (old) old.remove();
  const p = document.createElement("p");
  p.className = "error";
  p.textContent = message;
  form.prepend(p);
}

function renderStep2() {
  if (state.hasReservation) {
    form.innerHTML = `
      <div class="grid">
        <div class="field">
          <label>Rezervasyon Kodu</label>
          <input name="reservationCode" value="${state.reservationCode}" placeholder="Örn: RZV1001" required />
        </div>
        <div class="field">
          <label>Kaç kişi konaklayacak?</label>
          <input type="number" name="guestCount" min="1" max="8" value="${state.guestCount}" required />
        </div>
        ${buildGuestFields(state.guestCount, false)}
        <p class="helper">Rezervasyon varsa sadece kimlik/pasaport doğrulaması yapılır ve telefonunuza kapı kilidi için QR gönderilir.</p>
      </div>
      ${navButtons()}
    `;

    form.querySelector('input[name="guestCount"]').addEventListener("input", (e) => {
      state.guestCount = Math.max(1, Number(e.target.value || 1));
      renderStep2();
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      try {
        state.reservationCode = new FormData(form).get("reservationCode").toString().trim();
        state.guests = collectGuests(state.guestCount, false);
        const booking = reservationDb.find((r) => r.code === state.reservationCode);
        if (!booking) throw new Error("Rezervasyon kodu veri tabanında bulunamadı.");
        const allMatch = state.guests.every((g) => booking.ids.includes(g.identity));
        if (!allMatch) throw new Error("Kimlik/Pasaport bilgileri rezervasyon ile eşleşmiyor.");
        state.qrPayload = makeUniqueQrPayload({ room: "Önceden atanmış oda", type: "reservation" });
        state.step = 7;
        render();
      } catch (err) {
        showError(err.message);
      }
    };
    return;
  }

  form.innerHTML = `
    <div class="grid two">
      <div class="field">
        <label>Kaç kişisiniz?</label>
        <input type="number" name="guestCount" min="1" max="8" value="${state.guestCount}" required />
      </div>
      <div class="field">
        <label>Çıkış Tarihi</label>
        <input type="date" name="checkoutDate" value="${state.checkoutDate}" required />
      </div>
      <p class="helper" style="grid-column: 1 / -1;">Rezervasyon yoksa kişi sayısı ve çıkış tarihiyle devam edilir.</p>
    </div>
    ${navButtons()}
  `;

  form.onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(form);
    state.guestCount = Math.max(1, Number(data.get("guestCount") || 1));
    state.checkoutDate = data.get("checkoutDate").toString();
    state.step = 3;
    render();
  };
}

function renderStep3() {
  form.innerHTML = `
    <div class="grid">
      ${buildGuestFields(state.guestCount, true)}
      <p class="helper">Her kişi için vatandaşlık bilgisine göre TC kimlik numarası veya pasaport no giriniz.</p>
    </div>
    ${navButtons()}
  `;

  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      state.guests = collectGuests(state.guestCount, true);
      state.step = 4;
      render();
    } catch (err) {
      showError(err.message);
    }
  };
}

function renderStep4() {
  form.innerHTML = `
    <div class="grid">
      <div class="field">
        <label>Oda Türü Seçiniz</label>
        <select name="roomType" required>
          <option ${state.roomType === "Standart" ? "selected" : ""}>Standart</option>
          <option ${state.roomType === "Deluxe" ? "selected" : ""}>Deluxe</option>
          <option ${state.roomType === "Suit" ? "selected" : ""}>Suit</option>
        </select>
      </div>
    </div>
    ${navButtons()}
  `;

  form.onsubmit = (e) => {
    e.preventDefault();
    state.roomType = new FormData(form).get("roomType").toString();
    state.step = 5;
    render();
  };
}

function pickRoom(type) {
  const options = roomInventory[type];
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return options[seed % options.length];
}

function renderStep5() {
  if (!state.assignedRoom) {
    state.assignedRoom = pickRoom(state.roomType);
  }

  form.innerHTML = `
    <div class="grid">
      <p class="helper">Seçime göre önerilen oda atandı. Memnun değilseniz "Tekrar Oda Seç" ile yeni atama alabilirsiniz.</p>
      <div class="room-grid">
        <div class="room-card active">
          <strong>Oda ${state.assignedRoom}</strong>
          <p>Tür: ${state.roomType}</p>
          <p>Kişi: ${state.guestCount}</p>
          <p>Çıkış: ${state.checkoutDate || "Rezervasyona göre"}</p>
        </div>
      </div>
      <div class="nav">
        <button type="button" class="btn-secondary" onclick="state.assignedRoom=''; renderStep5();">Tekrar Oda Seç</button>
        <button type="submit" class="btn-primary">Odayı Onayla</button>
      </div>
    </div>
  `;

  form.onsubmit = (e) => {
    e.preventDefault();
    state.step = 6;
    render();
  };
}

function renderStep6() {
  form.innerHTML = `
    <div class="grid two">
      <div class="field">
        <label>Kart Üzerindeki İsim</label>
        <input name="cardName" required />
      </div>
      <div class="field">
        <label>Kart Numarası</label>
        <input name="cardNo" placeholder="16 hane" maxlength="16" required />
      </div>
      <div class="field">
        <label>SKT</label>
        <input name="expiry" placeholder="AA/YY" required />
      </div>
      <div class="field">
        <label>CVV</label>
        <input name="cvv" maxlength="4" required />
      </div>
    </div>
    ${navButtons("Ödemeyi Onayla")}
  `;

  form.onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const cardNo = data.get("cardNo").toString().replace(/\s+/g, "");
    if (!/^\d{16}$/.test(cardNo)) return showError("Kart numarası 16 haneli olmalıdır.");

    state.card = {
      cardName: data.get("cardName").toString(),
      cardNo,
      expiry: data.get("expiry").toString(),
      cvv: data.get("cvv").toString(),
    };

    state.qrPayload = makeUniqueQrPayload({ room: state.assignedRoom, type: "new-checkin" });
    state.step = 7;
    render();
  };
}

function makeUniqueQrPayload({ room, type }) {
  const random = crypto.randomUUID();
  return JSON.stringify({
    lockId: `LOCK-${room}`,
    room,
    type,
    token: random,
    oneTime: true,
    issuedAt: new Date().toISOString(),
  });
}

function renderStep7() {
  const parsed = JSON.parse(state.qrPayload);
  form.innerHTML = `
    <div class="grid">
      <h3>İşlem Tamamlandı ✅</h3>
      <p>Oda: <strong>${parsed.room}</strong></p>
      <p>Bu QR kod benzersizdir ve yalnızca <strong>${parsed.lockId}</strong> kapısını tek sefer açar.</p>
      <div class="qr-box">
        <canvas id="qrCanvas"></canvas>
        <div>
          <p><strong>Tek kullanımlık token:</strong></p>
          <code>${parsed.token}</code>
        </div>
      </div>
    </div>
    <div class="nav">
      <button type="button" class="btn-secondary" onclick="location.reload()">Yeni İşlem Başlat</button>
    </div>
  `;

  const canvas = document.getElementById("qrCanvas");
  QRCode.toCanvas(canvas, state.qrPayload, { width: 180, margin: 1 });

  result.classList.remove("hidden");
  result.innerHTML = `<strong>Bildirim:</strong> QR kod misafirin telefonuna gönderildi ve oda kilidi aktive edildi.`;
}

function prevStep() {
  state.step = Math.max(1, state.step - 1);
  render();
}

window.prevStep = prevStep;
window.state = state;
window.renderStep5 = renderStep5;

render();
