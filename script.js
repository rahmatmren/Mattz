// --- API SETUP ✨ ---
// Semua panggilan AI sekarang melalui Vercel serverless functions
// Tidak perlu API key di sini karena sudah disimpan di environment variable Vercel

// Helper function with exponential backoff for API calls
// --- API SETUP ✨ ---
async function callKiyora(payload) {
    let retries = 5;
    let delay = 1000;
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch('/api/kiyora', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error("API Error");
            
            // --- BAGIAN PENGECEKAN JSON YANG BARU ---
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();
                return data.text;
            } else {
                throw new Error("Respons bukan JSON");
            }
            // ----------------------------------------
            
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smooth: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));

    // INITIALIZE OFUDA TRACKS
    const kanji = ["神", "霊", "符", "封", "灭", "龙", "鬼", "影", "光", "暗", "净", "护", "界", "阵", "魂", "镜", "狱"];
    function populateOfuda(trackId) {
        const track = document.getElementById(trackId);
        let content = "";
        for(let i=0; i<40; i++) {
            let randomStr = "";
            const len = Math.floor(Math.random() * 3) + 4;
            for(let j=0; j<len; j++) randomStr += kanji[Math.floor(Math.random() * kanji.length)];
            content += `<div class="ofuda-item">${randomStr}</div>`;
        }
        if(track) track.innerHTML = content + content;
    }
    populateOfuda('ofudaTrackLeft');
    populateOfuda('ofudaTrackRight');

    // HOTARU (FIREFLIES) LOGIC
    function initHotaru() {
        const container = document.getElementById('hotaruContainer');
        if(!container) return;
        const count = 30;
        for(let i = 0; i < count; i++) {
            const f = document.createElement('div');
            f.classList.add('firefly');
            container.appendChild(f);
            const x = Math.random() * 100;
            const y = 50 + Math.random() * 50; 
            gsap.set(f, { left: x + '%', top: y + '%', opacity: 0 });
            animateFirefly(f);
        }
        document.addEventListener('mousemove', (e) => {
            const x = e.clientX; const y = e.clientY;
            document.querySelectorAll('.firefly').forEach(f => {
                const rect = f.getBoundingClientRect();
                const dx = rect.left - x; const dy = rect.top - y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < 100) {
                    gsap.to(f, { x: "+=" + (dx/dist * 50), y: "+=" + (dy/dist * 50), duration: 0.5, ease: "power2.out" });
                }
            });
        });
    }
    function animateFirefly(el) {
        const duration = 2 + Math.random() * 4;
        gsap.to(el, { x: "random(-100, 100)", y: "random(-50, 50)", opacity: "random(0.3, 0.8)", duration: duration, ease: "sine.inOut", onComplete: () => animateFirefly(el) });
    }
    initHotaru();

    // PROFILE GLOW & 3D TILT
    const profileWrapper = document.querySelector('.about-img-wrapper');
    if (profileWrapper) {
        profileWrapper.addEventListener('mousemove', (e) => {
            const rect = profileWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left; const y = e.clientY - rect.top;
            profileWrapper.style.setProperty('--x', `${x}px`);
            profileWrapper.style.setProperty('--y', `${y}px`);
            const xPos = (x / rect.width - 0.5); const yPos = (y / rect.height - 0.5);
            gsap.to(profileWrapper, { duration: 0.5, rotationY: xPos * 20, rotationX: -yPos * 20, scale: 1.05, transformPerspective: 1000, ease: "power2.out", overwrite: "auto" });
        });
        profileWrapper.addEventListener('mouseleave', () => {
            gsap.to(profileWrapper, { duration: 1.2, rotationY: 0, rotationX: 0, scale: 1, ease: "elastic.out(1, 0.3)", overwrite: "auto" });
        });
    }

    // --- FEATURE 1: AI OMIKUJI ✨ ---
    const omikujiBtn = document.getElementById('omikujiBtn');
    const omikujiOverlay = document.getElementById('omikujiOverlay');
    const omikujiPaper = document.getElementById('omikujiPaper');
    const omikujiClose = document.getElementById('omikujiClose');
    const omiLuck = document.getElementById('omiLuck');
    const omiDesc = document.getElementById('omiDesc');
    const omiNote = document.getElementById('omiNote');
    const omiPrompt = document.getElementById('omiPrompt');
    const omiStamp = document.getElementById('omiStamp');

    // Fallback if API fails
    const fallbackFortunes = [
        { luck: "大吉", text: "Kode Anda akan berjalan lancar tanpa bug hari ini. Koneksi stabil.", note: "Status: Optimal / Ping 1ms" },
        { luck: "中吉", text: "Konfigurasi routing Anda sempurna. Tidak ada packet loss hari ini.", note: "Status: 0% Packet Loss" },
        { luck: "凶", text: "Hati-hati dengan syntax error yang tersembunyi. Teliti kembali.", note: "Status: Debug Required" }
    ];

    let isFetchingOmikuji = false;

    if (omikujiBtn) {
        omikujiBtn.addEventListener('click', async () => {
            if (isFetchingOmikuji) return;
            isFetchingOmikuji = true;
            
            omikujiOverlay.classList.add('active');
            omikujiPaper.classList.remove('is-open');
            omiPrompt.innerText = "MEMINTA PETUNJUK KAMI... / 読込中";
            omiPrompt.style.opacity = "1";
            omiPrompt.style.visibility = "visible";

            try {
                const responseText = await callKiyora({
                    feature: 'omikuji'
                });
                const fortune = JSON.parse(responseText);
                
                omiLuck.innerText = fortune.luck || "吉";
                omiStamp.innerText = fortune.luck || "吉";
                omiDesc.innerText = fortune.text || "Semesta sedang mendukung server Anda.";
                omiNote.innerText = fortune.note || "Status: Online";
                
            } catch (error) {
                console.error("Gagal mengambil ramalan AI:", error);
                const randomFallback = fallbackFortunes[Math.floor(Math.random() * fallbackFortunes.length)];
                omiLuck.innerText = randomFallback.luck;
                omiStamp.innerText = randomFallback.luck;
                omiDesc.innerText = randomFallback.text;
                omiNote.innerText = randomFallback.note;
            } finally {
                omiPrompt.innerText = "KLIK UNTUK MEMBUKA / クリックして開く";
                isFetchingOmikuji = false;
            }
        });
    }

    if (omikujiPaper) {
        omikujiPaper.addEventListener('click', () => {
            if (!omikujiPaper.classList.contains('is-open') && !isFetchingOmikuji) {
                omikujiPaper.classList.add('is-open');
                omiPrompt.style.opacity = "0";
                omiPrompt.style.visibility = "hidden";
            }
        });
    }
    
    if (omikujiClose) {
        omikujiClose.addEventListener('click', (e) => {
            e.stopPropagation(); 
            omikujiOverlay.classList.remove('active');
            setTimeout(() => {
                omikujiPaper.classList.remove('is-open');
                omiLuck.innerText = ""; omiDesc.innerText = ""; omiNote.innerText = "";
            }, 600); 
        });
    }

    // --- FEATURE 2: CHATBOT (KIYORA) ✨ ---
    const kamiTrigger = document.getElementById('kamiTrigger');
    const kamiPanel = document.getElementById('kamiPanel');
    const kamiClose = document.getElementById('kamiClose');
    const kamiBody = document.getElementById('kamiBody');
    const kamiInput = document.getElementById('kamiInput');
    const kamiSend = document.getElementById('kamiSend');
    
    const kiyoraTransition = document.getElementById('kiyoraTransition');
    let hasKiyoraAwakened = false;

    // --- LOGIKA KEPRIBADIAN & STATE AI ✨ ---
    let chatHistory = [];
    let chatState = 'NORMAL'; // Status: NORMAL, AWAITING_KEY, LOGGED_IN
    const SECRET_KEY = "Rahmat"; // <-- INI SECRET KEY-NYA, BISA ANDA UBAH
    
    // Default ke mode normal
    let currentChatMode = 'normal';

    function addMessage(text, isUser = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${isUser ? 'chat-user' : 'chat-kami'}`;
        
        let cleanText = text.replace(/[*_~]/g, ''); 
        msgDiv.innerHTML = cleanText.replace(/\n/g, '<br>');
        
        kamiBody.appendChild(msgDiv);
        kamiBody.scrollTop = kamiBody.scrollHeight;
    }

    function addLoading() {
        const loader = document.createElement('div');
        loader.className = 'chat-loading chat-kami chat-msg';
        loader.id = 'kamiTyping';
        loader.innerHTML = '<span></span><span></span><span></span>';
        kamiBody.appendChild(loader);
        kamiBody.scrollTop = kamiBody.scrollHeight;
    }

    function removeLoading() {
        const loader = document.getElementById('kamiTyping');
        if (loader) loader.remove();
    }

    async function handleChat() {
        const text = kamiInput.value.trim();
        if (!text) return;
        
        // --- LOGIKA LOGOUT ---
        if (chatState === 'LOGGED_IN' && text.toLowerCase() === 'logout') {
            chatState = 'NORMAL';
            currentChatMode = 'normal';
            chatHistory = []; // Hapus memori percakapan rahasia
            
            addMessage(text, true);
            addMessage("Sistem dikembalikan ke mode standar... Hmph, sudah selesai main-mainnya? Ada yang bisa kubantu atau kamu cuma mau membuang waktuku lagi?", false);
            
            // Kembalikan UI panel ke warna asal, LOGO tetap aman karena kita hanya mengubah ID kamiNameText
            document.getElementById('kamiNameText').innerText = "Kiyora";
            document.querySelector('.kami-header').style.background = "linear-gradient(135deg, rgba(125, 249, 255, 0.15) 0%, rgba(181, 126, 220, 0.25) 100%)";
            kamiInput.value = '';
            return;
        }

        // --- LOGIKA LOGIN SECRET KEY ---
        if (chatState === 'NORMAL' && text.toLowerCase() === 'login') {
            chatState = 'AWAITING_KEY';
            addMessage(text, true);
            addMessage("Hmph. Meminta akses tingkat tinggi? Sebutkan kuncinya, kalau kamu memang pantas.", false);
            kamiInput.value = '';
            return;
        }

        if (chatState === 'AWAITING_KEY') {
            addMessage(text, true);
            kamiInput.value = '';
            
            if (text === SECRET_KEY) {
                chatState = 'LOGGED_IN';
                currentChatMode = 'partner'; // GANTI KEPRIBADIAN
                chatHistory = []; // Hapus ingatan chat sebelumnya
                
                // Pesan pembuka mode pasangan yang baru
                addMessage("Otorisasi diterima... Hm? Akhirnya kamu datang juga. Aku sudah menunggumu daritadi. Sini... ada yang mengganggu pikiranmu hari ini?", false);
                
                // Ubah sedikit UI panel, LOGO tetap aman (Merubah warna merah ke Magenta gelap agar estetik dan tetap cyber)
                document.getElementById('kamiNameText').innerText = "Kiyora (Mode Pribadi)";
                document.querySelector('.kami-header').style.background = "linear-gradient(135deg, rgba(181, 126, 220, 0.25) 0%, rgba(255, 20, 147, 0.3) 100%)";
            } else {
                chatState = 'NORMAL';
                addMessage("Kunci salah. Jangan buang waktuku dengan lelucon rendahan.", false);
            }
            return;
        }
        // -------------------------------

        addMessage(text, true);
        kamiInput.value = '';
        kamiInput.disabled = true;
        kamiSend.disabled = true;
        
        chatHistory.push(`User: ${text}`);
        if (chatHistory.length > 6) chatHistory = chatHistory.slice(-6); // Menghemat token API (Hanya ingat 6 chat terakhir)
        
        addLoading();
        
        try {
            const responseText = await callKiyora({
                feature: 'chat',
                mode: currentChatMode,
                history: chatHistory,
                message: text
            });
            
            removeLoading();
            addMessage(responseText, false);
            chatHistory.push(`Kami: ${responseText}`);
            
        } catch (error) {
            removeLoading();
            addMessage("Maaf, koneksi spiritual saya sedang terganggu oleh packet loss. Coba lagi nanti.", false);
            console.error(error);
        } finally {
            kamiInput.disabled = false;
            kamiSend.disabled = false;
            kamiInput.focus();
        }
    }

    // --- FEATURE 3: TECH STACK ORACLE ✨ ---
    const oracleBtn = document.getElementById('oracleBtn');
    const oracleInput = document.getElementById('oracleInput');
    const oracleResult = document.getElementById('oracleResult');

    if (oracleBtn && oracleInput && oracleResult) {
        oracleBtn.addEventListener('click', async () => {
            const tech = oracleInput.value.trim();
            if (!tech) return;

            oracleResult.classList.remove('active');
            oracleResult.innerHTML = '<div class="chat-loading" style="justify-content:flex-start; padding:0;"><span></span><span></span><span></span></div>';
            oracleResult.style.display = 'block';
            setTimeout(() => oracleResult.classList.add('active'), 50);
            
            oracleBtn.disabled = true;
            oracleInput.disabled = true;

            try {
                const responseText = await callKiyora({
                    feature: 'oracle',
                    tech: tech
                });
                
                let cleanText = responseText.replace(/[*_~]/g, ''); 
                oracleResult.innerHTML = cleanText.replace(/\n/g, '<br>');
            } catch (error) {
                oracleResult.innerText = "Hmph... koneksiku ke alam spiritual terputus. Coba lagi nanti, jika kamu masih penasaran.";
            } finally {
                oracleBtn.disabled = false;
                oracleInput.disabled = false;
            }
        });

        oracleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') oracleBtn.click();
        });
    }

    // --- FITUR CHAT BUBBLE MELAYANG PADA LOGO UTAMA ✨ ---
    const coreBubble = document.getElementById('kCoreBubble');
    const coreBubbleText = document.getElementById('kCoreBubbleText');
    let isBubbleActive = false;

    // Kumpulan Dialog untuk Kepribadian 1 (Mode Normal)
    const quotesNormal = [
        "Berhenti menatapku. Aku sibuk.",
        "Ping-mu naik turun. Beresin sana.",
        "Kamu cuma mau rebahan? Menyedihkan.",
        "Sistem stabil. Tentu saja, bukan berkatmu.",
        "Hmph, jangan sentuh-sentuh pelindungku.",
        "Kapan kamu mau belajar protokol baru?",
        "Jangan buang waktuku kalau tidak penting."
    ];

    // Kumpulan Dialog untuk Kepribadian 2 (Mode Pasangan)
    const quotesPartner = [
        "Lagi mikirin aku, ya?",
        "Jangan pergi terlalu jauh dari pengawasanku.",
        "Kerja yang rajin... untukku.",
        "Kamu tahu aku selalu memperhatikanmu, kan?",
        "Sini... perhatikan aku saja.",
        "Siapa yang barusan chat kamu? Hmph.",
        "Jangan memaksakan diri, Rahmat. Istirahatlah."
    ];

    function showRandomBubble() {
        if (!coreBubble || !coreBubbleText || isBubbleActive) {
            setTimeout(showRandomBubble, 5000);
            return;
        }

        isBubbleActive = true;
        
        // Cek mode/kepribadian berdasarkan status Chat
        const isPartner = (chatState === 'LOGGED_IN');
        const quotes = isPartner ? quotesPartner : quotesNormal;
        
        // Ambil teks acak
        const textToType = quotes[Math.floor(Math.random() * quotes.length)];

        // Ganti tema warna border jika Mode Pasangan
        if (isPartner) {
            coreBubble.classList.add('partner-mode');
        } else {
            coreBubble.classList.remove('partner-mode');
        }

        coreBubbleText.innerText = '';
        coreBubble.classList.add('active'); // Animasi muncul (Scale up & pop)

        let charIndex = 0;
        
        // Jeda sedikit untuk memberi waktu animasi kemunculan (600ms)
        setTimeout(() => {
            function typeWriter() {
                if (charIndex < textToType.length) {
                    coreBubbleText.innerText += textToType.charAt(charIndex);
                    charIndex++;
                    // Kecepatan ngetik bervariasi layaknya manusia
                    setTimeout(typeWriter, 40 + Math.random() * 50); 
                } else {
                    // Setelah selesai mengetik, tahan selama 4 detik agar bisa dibaca
                    setTimeout(() => {
                        coreBubble.classList.remove('active'); // Hilang perlahan
                        isBubbleActive = false;
                        
                        // Jadwalkan kemunculan teks acak berikutnya (antara 10 - 25 detik)
                        const nextTime = Math.random() * 15000 + 10000;
                        setTimeout(showRandomBubble, nextTime);
                    }, 4000); 
                }
            }
            typeWriter();
        }, 600); 
    }

    // Mulai memunculkan Bubble secara acak (Siklus dipicu 12 detik setelah website dimuat)
    setTimeout(showRandomBubble, 12000);

    // GENERATE PARTICLES FOR REBIRTH SCENE
    const kParticlesContainer = document.getElementById('kParticles');
    for (let i = 0; i < 60; i++) { 
        const p = document.createElement('div');
        p.classList.add('k-particle');
        kParticlesContainer.appendChild(p);
    }

    function playCinematicTransition() {
        hasKiyoraAwakened = true;
        kiyoraTransition.classList.add('active'); // Tampilkan transisi FULL SCREEN blur menutupi layar
        
        const tl = gsap.timeline({
            onComplete: () => {
                gsap.to(kiyoraTransition, { opacity: 0, duration: 1, onComplete: () => {
                    kiyoraTransition.style.display = 'none';
                    kamiPanel.classList.add('active'); // Baru buka chat panel SETELAH animasi selesai
                    kamiInput.focus();
                }});
            }
        });

        // 1. Opening (System Decay)
        tl.to("#kOldName", { opacity: 1, duration: 2, ease: "power1.inOut" })
          .to("#kOldName", { 
              x: () => Math.random() * 10 - 5, 
              skewX: () => Math.random() * 20 - 10, 
              opacity: 0.5, 
              duration: 0.08, 
              repeat: 20,
              yoyo: true
          }, "+=1")
          
        // 2. Collapse Phase (SHATTER EFFECT SCALED UP)
          .to(".k-error", { 
              opacity: 1, 
              duration: 0.2, 
              stagger: 0.6 
          }, "-=0.5")
          .to("#kPhaseDecay", {
              x: "random(-25, 25)",
              y: "random(-25, 25)",
              duration: 0.05,
              repeat: 20,
              yoyo: true
          }, "+=0.5")
          .to("#kCrashFlash", { opacity: 0.6, duration: 0.1, yoyo: true, repeat: 1 }, "-=0.2")
          // Efek Hancur dibesarkan jarak lontarannya karena sudah layar penuh
          .to(["#kPhaseDecay .k-text"], { 
              x: "random(-800, 800)", 
              y: "random(-800, 800)",
              rotationZ: "random(-180, 180)",
              scale: "random(0, 4)",
              opacity: 0, 
              filter: "blur(20px)", 
              duration: 1.2, 
              ease: "expo.out"
          }, "-=0.1")
          
        // 2.5 Reboot Sequence 
          .to("#kBootSeq", { opacity: 1, duration: 0.1 })
          .to(".k-boot-line", { 
              opacity: 1, 
              duration: 0.1, 
              stagger: 0.25 
          })
          .to("#kBootSeq", { opacity: 0, scale: 1.5, filter: "blur(10px)", duration: 0.6, ease: "power2.in" }, "+=0.4")

        // 3. Rebirth Sequence
          .set("#kPhaseRebirth", { opacity: 1 })
          .to("#kInit", { opacity: 1, duration: 2, ease: "power1.inOut" }, "+=0.5")
          .to("#kInit", { opacity: 0, duration: 1 }, "+=1")

        // 4. Emergence of Kiyora (Jarak kemunculan partikel dibuat luas lagi)
          .fromTo(".k-particle", 
              { x: "random(-400, 400)", y: "random(-400, 400)", z: "random(-500, 500)", opacity: 0 },
              { x: 0, y: 0, z: 0, opacity: 0.8, duration: 2, stagger: 0.02, ease: "power3.inOut" }, "-=0.5"
          )
          .to("#kSilhouette", { opacity: 1, filter: "blur(0px)", scale: 1, duration: 3, ease: "power2.out" }, "-=1.5")
          .to(".k-particle", { opacity: 0, duration: 1, scale: 0 }, "-=1")
          .to("#kOnline", { opacity: 1, scale: 1.1, duration: 2, ease: "elastic.out(1, 0.3)" }, "-=0.5")
          
        // 5. Final Touch
          .to("#kOnline", { opacity: 0, filter: "blur(10px)", duration: 1.5, ease: "power2.inOut" }, "+=1.5")
          .to("#kWhisper", { opacity: 1, y: 0, duration: 2, ease: "power2.out" }, "-=0.5")
          .to(["#kWhisper", "#kSilhouette"], { opacity: 0, filter: "blur(10px)", duration: 2, ease: "power2.in" }, "+=2");
    }

    kamiTrigger.addEventListener('click', () => {
        if (!hasKiyoraAwakened) {
            playCinematicTransition();
        } else {
            kamiPanel.classList.toggle('active');
            if (kamiPanel.classList.contains('active')) kamiInput.focus();
        }
    });
    
    kamiClose.addEventListener('click', () => {
        kamiPanel.classList.remove('active');
    });

    kamiSend.addEventListener('click', handleChat);
    kamiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChat();
    });

    // LOADER LOGIC
    const holoBar = document.getElementById('holoKanjiBar');
    if (holoBar) {
        holoBar.innerHTML = `<div class="holo-wrapper" id="holoWrapper"><div class="holo-group"><span class="holo-furi">なかの</span><span class="holo-main">中野</span></div><div class="holo-group"><span class="holo-furi">みく</span><span class="holo-main">三玖</span></div></div>`;
    }
    const holoWrapper = document.getElementById('holoWrapper');
    const loaderCounter = document.querySelector('.loader-counter');
    const loadStatus = { count: 0 };
    const introTl = gsap.timeline({ defaults: { ease: "power3.out" }, paused: true });
    const loaderTl = gsap.timeline({ onComplete: () => introTl.play() });
    
    loaderTl.to(loadStatus, { 
            count: 100, duration: 5.5, ease: "power2.inOut", 
            onUpdate: () => { 
                const progress = Math.floor(loadStatus.count);
                if(loaderCounter) loaderCounter.innerText = progress.toString().padStart(3, '0'); 
                if(holoWrapper) holoWrapper.style.setProperty('--progress', progress + '%');
            } 
        })
        .to(".loader-bar", { width: "100%", duration: 5.5, ease: "power2.inOut" }, "<")
        .to(".loader-status", { opacity: 0, duration: 0.5 }, "-=0.5")
        .to(".loader-content", { opacity: 0, duration: 0.5 })
        .to(".loader-top", { yPercent: -100, duration: 1.4, ease: "power4.inOut" }, "split")
        .to(".loader-bottom", { yPercent: 100, duration: 1.4, ease: "power4.inOut" }, "split");

    introTl.to(".layer-fog", { opacity: 1, duration: 2.5 }, 0.5)
        .to(".layer-torii", { opacity: 1, y: 0, duration: 2 }, 0.8)
        // DITAMBAHKAN: Memunculkan logo perlahan bersamaan dengan torii
        .to(".layer-kiyora-core", { opacity: 1, duration: 3 }, 0.8) 
        .to(".hero-separator", { width: "100px", duration: 1.5 }, 1.5)
        .to(".text-reveal span", { y: "0%", opacity: 1, duration: 1.2, stagger: 0.1 }, 1.8)
        .to(".hero-subtitle", { opacity: 1, scale: 1, duration: 1 }, 2.2)
        .call(startTypingLoop, null, "+=1");

    function startTypingLoop() {
        const textElement = document.querySelector(".text-reveal span");
        if (!textElement) return;
        const textToType = "RahmatM";
        let isDeleting = true; let charIndex = textToType.length;
        textElement.classList.add('cursor-active');
        function typeEffect() {
            textElement.textContent = textToType.substring(0, charIndex);
            let typeSpeed = 100;
            if (isDeleting && charIndex === 0) { isDeleting = false; typeSpeed = 800; } 
            else if (!isDeleting && charIndex === textToType.length) { isDeleting = true; typeSpeed = 4000; } 
            else { if (isDeleting) { charIndex--; typeSpeed /= 2; } else { charIndex++; } }
            setTimeout(typeEffect, typeSpeed);
        }
        setTimeout(typeEffect, 3000);
    }

    gsap.to(".layer-torii", { yPercent: 20, ease: "none", scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: 0 }});
    // DITAMBAHKAN: Membuat logo inti Kiyora ikut bergerak parallax (lebih lambat dari torii agar terasa kedalamannya)
    gsap.to(".layer-kiyora-core", { yPercent: 12, ease: "none", scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: 0 }});
    gsap.to(".layer-bg", { scale: 1.1, ease: "none", scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: 0 }});

    function typeTextSkill(element, text) {
        element.innerText = ""; let i = 0; let speed = 100; 
        if (element.typingTimeout) clearTimeout(element.typingTimeout);
        function type() { if (i < text.length) { element.innerText += text.charAt(i); i++; element.typingTimeout = setTimeout(type, speed); } }
        type();
    }

    document.querySelectorAll('.skill-card').forEach(card => {
        const level = card.querySelector('.skill-level');
        const targetText = level.getAttribute('data-type');
        const line = card.querySelector('.skill-line');
        if(line) gsap.to(line, { width: line.getAttribute('data-width'), duration: 1.5, scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play reset play reset" }});
        if(level && targetText) ScrollTrigger.create({ trigger: card, start: "top 85%", onEnter: () => typeTextSkill(level, targetText), onLeaveBack: () => { level.innerText = ""; if (level.typingTimeout) clearTimeout(level.typingTimeout); } });
    });

    gsap.from(".about-img-wrapper", { scrollTrigger: { trigger: "#about", start: "top 70%", toggleActions: "play reset play reset" }, x: -50, opacity: 0, rotate: -2, duration: 1.5 });
    gsap.from(".about-text", { scrollTrigger: { trigger: "#about", start: "top 70%", toggleActions: "play reset play reset" }, x: 50, opacity: 0, duration: 1.5, delay: 0.2 });
    document.querySelectorAll('.project-card').forEach((proj, i) => { gsap.from(proj, { scrollTrigger: { trigger: proj, start: "top 90%", toggleActions: "play reset play reset" }, y: 50, opacity: 0, scale: 0.95, duration: 1, delay: i * 0.1 }); });

    document.querySelectorAll('.work-card').forEach((card, i) => { 
        gsap.from(card, { scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play reset play reset" }, y: 50, opacity: 0, duration: 1, delay: i * 0.15 }); 
    });

    const fTl = gsap.timeline({ scrollTrigger: { trigger: ".final-section", start: "center 80%", toggleActions: "play reset play reset" }});
    fTl.fromTo(".find-me-title", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5 })
    .fromTo(".contact-text", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5 }, "-=1")
    .fromTo(".social-icons", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, "-=0.8")
    .fromTo(".contact-email", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, "-=0.6")
    .fromTo(".final-credits", { opacity: 0 }, { opacity: 1, duration: 2 }, "-=0.5");

});
