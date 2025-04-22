// --- Cấu hình Game ---
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            // debug: true,
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// --- Biến toàn cục ---
let miner;
let claw;
let ropeGraphics;
let targets;
let score = 0;
let scoreText;
let timer;
let timerText;
let timeLeft = 60;
let goal = 500;
let goalText;
let levelText;
let currentLevel = 1;

// --- Trạng thái của mỏ neo (Thêm LEVEL_CLEARED) ---
const CLAW_STATE = {
    SWINGING: 'swinging',
    EXTENDING: 'extending',
    RETRACTING: 'retracting',
    LEVEL_CLEARED: 'level_cleared', // Trạng thái khi đạt mục tiêu sớm
    DONE: 'done' // Trạng thái khi hết giờ
};
let clawState = CLAW_STATE.SWINGING;

let swingAngle = 0;
let swingDirection = 1;
const SWING_SPEED = 1;
const SWING_LIMIT = 75;

const CLAW_EXTEND_SPEED = 400;
let clawRetractSpeed = 100;
let targetAttached = null;

const PIVOT_X = config.width / 2;
const PIVOT_Y = 110;

// --- Khởi tạo Game ---
const game = new Phaser.Game(config);

// --- Hàm Preload ---
function preload() {
    console.log("Preloading assets...");
    createPlaceholders(this); // Sử dụng placeholders
}

// --- Hàm Create ---
function create() {
    console.log("Creating game objects...");

    // Nền đất thủ công
    const groundGraphics = this.add.graphics();
    groundGraphics.fillStyle(0x8B4513, 1);
    groundGraphics.fillRect(0, PIVOT_Y + 50, config.width, config.height - (PIVOT_Y + 50));

    // Miner
    miner = this.add.sprite(PIVOT_X, PIVOT_Y - 30, 'miner').setOrigin(0.5, 1);

    // Dây neo
    ropeGraphics = this.add.graphics();

    // Claw
    claw = this.physics.add.sprite(PIVOT_X, PIVOT_Y, 'claw').setOrigin(0.5, 0);
    claw.setCollideWorldBounds(false);
    claw.body.allowGravity = false;
    claw.setDepth(1);

    // Targets group
    targets = this.physics.add.group({
        allowGravity: false,
        immovable: true
    });
    generateTargets(this);

    // Va chạm
    this.physics.add.overlap(claw, targets, hitTarget, null, this);

    // Hiển thị UI
    scoreText = this.add.text(16, 16, `Điểm: ${score}`, { fontSize: '24px', fill: '#fff', fontStyle: 'bold' });
    goalText = this.add.text(16, 46, `Mục tiêu: ${goal}`, { fontSize: '24px', fill: '#FFFF00', fontStyle: 'bold' });
    timerText = this.add.text(config.width - 150, 16, `Thời gian: ${timeLeft}`, { fontSize: '24px', fill: '#fff', fontStyle: 'bold' });
    levelText = this.add.text(config.width / 2, 16, `Màn: ${currentLevel}`, { fontSize: '24px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5, 0);

    // Timer
    timer = this.time.addEvent({
        delay: 1000,
        callback: updateTimer,
        callbackScope: this,
        loop: true
    });

    // Input (phóng neo) - Cập nhật để không phóng khi màn hình kết thúc/đạt mục tiêu
    this.input.keyboard.on('keydown-SPACE', launchClaw, this);
    this.input.on('pointerdown', (pointer) => {
        // Chỉ phóng neo nếu đang lắc và không click vào các nút trên màn hình kết thúc/đạt mục tiêu
        if (clawState === CLAW_STATE.SWINGING) {
            const topObject = this.input.manager.hitTest(pointer, this.children.list, this.cameras.main, 1)[0];
            if (!topObject || topObject.depth < 10) { // Nút có depth >= 10
                launchClaw();
            }
        }
    }, this);

    // Reset trạng thái ban đầu
    clawState = CLAW_STATE.SWINGING;
    targetAttached = null;
    score = 0; // Đảm bảo điểm reset khi tạo scene
    // timeLeft và goal được giữ lại từ lần chơi trước nếu restart
    // Cập nhật lại hiển thị UI ban đầu
    scoreText.setText(`Điểm: ${score}`);
    goalText.setText(`Mục tiêu: ${goal}`);
    timerText.setText(`Thời gian: ${timeLeft}`);
    levelText.setText(`Màn: ${currentLevel}`);
    resetClawPosition();
}

// --- Hàm Update ---
function update(time, delta) {
    // Dừng update nếu màn chơi đã kết thúc hoặc đã đạt mục tiêu
    if (clawState === CLAW_STATE.DONE || clawState === CLAW_STATE.LEVEL_CLEARED) {
        return;
    }

    // Cập nhật trạng thái claw
    switch (clawState) {
        case CLAW_STATE.SWINGING:
            updateSwinging(delta);
            break;
        case CLAW_STATE.EXTENDING:
            updateExtending(delta);
            break;
        case CLAW_STATE.RETRACTING:
            updateRetracting(delta);
            break;
    }

    // Vẽ dây neo
    drawRope();
}

// --- Các hàm trợ giúp ---

function createPlaceholders(scene) { /* ... giữ nguyên code tạo placeholder ... */
    let graphics;

    // Miner placeholder
    graphics = scene.add.graphics();
    graphics.fillStyle(0xFFA500, 1); // Orange
    graphics.fillRect(0, 0, 60, 80);
    graphics.generateTexture('miner', 60, 80);
    graphics.destroy();

    // Claw placeholder
    graphics = scene.add.graphics();
    graphics.fillStyle(0x808080, 1); // Gray
    graphics.lineStyle(2, 0xFFFFFF, 1); // White outline
    graphics.beginPath();
    graphics.moveTo(15, 0); // Adjusted for better visual center
    graphics.lineTo(0, 30);
    graphics.lineTo(30, 30);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    graphics.generateTexture('claw', 30, 30); // Adjusted size
    graphics.destroy();

    // Gold placeholders
    const goldColors = { s: 0xFFD700, m: 0xFFEC8B, l: 0xFFF68F }; // Vàng đậm -> nhạt
    const goldSizes = { s: 20, m: 35, l: 50 };
    for (const sizeKey in goldSizes) {
        graphics = scene.add.graphics();
        graphics.fillStyle(goldColors[sizeKey], 1);
        graphics.fillRect(0, 0, goldSizes[sizeKey], goldSizes[sizeKey]);
        graphics.generateTexture(`gold_${sizeKey}`, goldSizes[sizeKey], goldSizes[sizeKey]);
        graphics.destroy();
    }

    // Rock placeholders
    const rockColors = { s: 0xA9A9A9, l: 0x696969 }; // Xám nhạt -> đậm
    const rockSizes = { s: 30, l: 55 };
     for (const sizeKey in rockSizes) {
        graphics = scene.add.graphics();
        graphics.fillStyle(rockColors[sizeKey], 1);
        // Vẽ hình đa giác ngẫu nhiên hơn cho đá
        graphics.beginPath();
        graphics.moveTo(rockSizes[sizeKey] * 0.5, 0);
        graphics.lineTo(rockSizes[sizeKey], rockSizes[sizeKey] * 0.3);
        graphics.lineTo(rockSizes[sizeKey] * 0.8, rockSizes[sizeKey]);
        graphics.lineTo(rockSizes[sizeKey] * 0.2, rockSizes[sizeKey]);
        graphics.lineTo(0, rockSizes[sizeKey] * 0.7);
        graphics.closePath();
        graphics.fillPath();
        graphics.generateTexture(`rock_${sizeKey}`, rockSizes[sizeKey], rockSizes[sizeKey]);
        graphics.destroy();
    }

     // Diamond placeholder
    graphics = scene.add.graphics();
    graphics.fillStyle(0x00FFFF, 1); // Cyan
    graphics.lineStyle(1, 0xFFFFFF, 1);
    graphics.beginPath();
    graphics.moveTo(10, 0);
    graphics.lineTo(20, 15);
    graphics.lineTo(10, 30);
    graphics.lineTo(0, 15);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    graphics.generateTexture('diamond', 20, 30);
    graphics.destroy();
}

function generateTargets(scene) { /* ... giữ nguyên code sinh targets ... */
    targets.clear(true, true); // Xóa các vật phẩm cũ (nếu có)

    const itemTypes = [
        { key: 'gold_s', value: 50, weight: 5 },
        { key: 'gold_m', value: 100, weight: 8 },
        { key: 'gold_l', value: 250, weight: 12 },
        { key: 'rock_s', value: 10, weight: 15 },
        { key: 'rock_l', value: 20, weight: 25 },
        { key: 'diamond', value: 600, weight: 3 },
    ];

    const minItems = 10;
    const maxItems = 15;
    const numberOfItems = Phaser.Math.Between(minItems, maxItems);

    const minY = PIVOT_Y + 100; // Vị trí Y tối thiểu để vật phẩm xuất hiện (tăng khoảng cách)
    const padding = 40; // Khoảng cách tối thiểu giữa các vật phẩm (tăng lên)

    for (let i = 0; i < numberOfItems; i++) {
        const itemData = Phaser.Utils.Array.GetRandom(itemTypes);
        let x, y, overlapping;

        // Thử tìm vị trí không chồng chéo
        let attempts = 0;
        do {
            overlapping = false;
            // Lấy kích thước texture để tính toán biên X tốt hơn
            const texture = scene.textures.get(itemData.key);
            const itemWidth = texture.source[0].width;
            const itemHeight = texture.source[0].height;

            x = Phaser.Math.Between(padding + itemWidth / 2, config.width - padding - itemWidth / 2);
            y = Phaser.Math.Between(minY, config.height - padding - itemHeight / 2);

            // Kiểm tra chồng chéo với các vật phẩm đã tạo (dùng hình chữ nhật bao)
             targets.children.iterate(existingTarget => {
                 if (existingTarget) {
                     const existingRect = existingTarget.getBounds();
                     // Tạo hình chữ nhật tạm thời cho vật phẩm tiềm năng
                     const potentialRect = new Phaser.Geom.Rectangle(x - itemWidth / 2, y - itemHeight / 2, itemWidth, itemHeight);
                     if (Phaser.Geom.Intersects.RectangleToRectangle(potentialRect, existingRect)) {
                         overlapping = true;
                     }
                 }
            });
            attempts++;
        } while (overlapping && attempts < 100); // Tăng số lần thử

        if (!overlapping) {
            const target = targets.create(x, y, itemData.key);
            target.setData('value', itemData.value);
            target.setData('weight', itemData.weight); // Trọng lượng ảnh hưởng tốc độ kéo
            // target.body.setSize(target.width * 0.8, target.height * 0.8); // Điều chỉnh hitbox nếu cần
        } else {
             console.warn(`Could not place item ${itemData.key} without overlapping after ${attempts} attempts.`);
        }
    }
}

function updateSwinging(delta) { /* ... giữ nguyên ... */
    if (clawState === CLAW_STATE.SWINGING) {
        swingAngle += swingDirection * SWING_SPEED * (delta / 16.66);
        if (swingAngle > SWING_LIMIT || swingAngle < -SWING_LIMIT) {
            swingDirection *= -1;
            swingAngle = Phaser.Math.Clamp(swingAngle, -SWING_LIMIT, SWING_LIMIT);
        }
        claw.setAngle(swingAngle);
        resetClawPosition();
    }
}

function updateExtending(delta) { /* ... giữ nguyên ... */
    if (claw.y >= config.height - claw.height ||
        claw.x <= claw.width / 2 ||
        claw.x >= config.width - claw.width / 2)
    {
        startRetracting();
    }
}

function updateRetracting(delta) { /* ... giữ nguyên, chỉ sửa phần reset state ... */
    const targetAngleRad = Phaser.Math.Angle.Between(claw.x, claw.y, PIVOT_X, PIVOT_Y);
    game.scene.scenes[0].physics.velocityFromRotation(targetAngleRad, clawRetractSpeed, claw.body.velocity);

    if (targetAttached) {
        targetAttached.x = claw.x;
        targetAttached.y = claw.y + claw.height * 0.7;
    }

    const distance = Phaser.Math.Distance.Between(claw.x, claw.y, PIVOT_X, PIVOT_Y);
    if (distance < 15) {
        // Xử lý vật phẩm nếu có
        if (targetAttached) {
            collectTarget(targetAttached, game.scene.scenes[0]); // Truyền scene context
            targetAttached = null;
        }

        // *** THAY ĐỔI Ở ĐÂY ***
        // Chỉ quay lại SWINGING nếu game chưa kết thúc hoặc chưa đạt mục tiêu
        if (clawState !== CLAW_STATE.DONE && clawState !== CLAW_STATE.LEVEL_CLEARED) {
            clawState = CLAW_STATE.SWINGING;
            resetClawPosition();
        } else {
            claw.body.setVelocity(0, 0); // Dừng hẳn nếu game đã pause/done
        }
    }
}

function drawRope() { /* ... giữ nguyên ... */
    ropeGraphics.clear();
    ropeGraphics.lineStyle(4, 0xFFFFFF, 1);
    ropeGraphics.beginPath();
    ropeGraphics.moveTo(PIVOT_X, PIVOT_Y);
    ropeGraphics.lineTo(claw.x, claw.y);
    ropeGraphics.strokePath();
    ropeGraphics.setDepth(0);
}

function launchClaw() { /* ... giữ nguyên ... */
    if (clawState === CLAW_STATE.SWINGING) {
        console.log("Launching claw!");
        clawState = CLAW_STATE.EXTENDING;
        const physicsAngleDeg = 90 + claw.angle;
        const launchAngleRad = Phaser.Math.DegToRad(physicsAngleDeg);
        console.log(`Swing Angle (deg): ${claw.angle.toFixed(2)}, Physics Angle (deg): ${physicsAngleDeg.toFixed(2)}, Launch Angle (rad): ${launchAngleRad.toFixed(2)}`);
        game.scene.scenes[0].physics.velocityFromRotation(launchAngleRad, CLAW_EXTEND_SPEED, claw.body.velocity);
    }
}

function hitTarget(clawObject, targetObject) { /* ... giữ nguyên ... */
    if (clawState === CLAW_STATE.EXTENDING && !targetAttached) {
        console.log("Hit target!", targetObject.texture.key);
        claw.body.setVelocity(0, 0);
        targetAttached = targetObject;
        targetAttached.body.enable = false;
        const weight = targetAttached.getData('weight') || 10;
        clawRetractSpeed = Math.max(50, 350 - weight * 8);
        console.log(`Target Weight: ${weight}, Retract speed: ${clawRetractSpeed}`);
        startRetracting();
    }
}

function startRetracting() { /* ... giữ nguyên ... */
     if (clawState === CLAW_STATE.EXTENDING || clawState === CLAW_STATE.RETRACTING) {
        clawState = CLAW_STATE.RETRACTING;
        if (!targetAttached) {
            console.log("Retracting without target (hit boundary)");
            clawRetractSpeed = 300;
        }
     }
}

// --- THAY ĐỔI QUAN TRỌNG: Kiểm tra điểm trong collectTarget ---
// Thêm tham số 'scene' để gọi hàm hiển thị màn hình mới
function collectTarget(target, scene) {
    const value = target.getData('value') || 0;
    score += value;
    scoreText.setText(`Điểm: ${score}`);
    console.log(`Collected ${target.texture.key}, value: ${value}. New score: ${score}`);
    target.destroy(); // Xóa vật phẩm

    // *** KIỂM TRA ĐẠT MỤC TIÊU ***
    // Chỉ kích hoạt nếu chưa kết thúc hoặc chưa clear level
    if (score >= goal && clawState !== CLAW_STATE.DONE && clawState !== CLAW_STATE.LEVEL_CLEARED) {
        console.log("Goal reached early!");
        clawState = CLAW_STATE.LEVEL_CLEARED; // Đặt trạng thái mới
        timer.paused = true; // Dừng timer
        claw.body.setVelocity(0, 0); // Dừng claw ngay lập tức
        showLevelClearedScreen(scene); // Hiển thị màn hình "Đạt mục tiêu"
    }
}


function resetClawPosition() { /* ... giữ nguyên ... */
    if (clawState === CLAW_STATE.SWINGING) {
        claw.setPosition(PIVOT_X, PIVOT_Y);
        claw.setAngle(swingAngle);
        claw.body.setVelocity(0,0);
    }
}

// --- Cập nhật Timer ---
function updateTimer() {
    // Không làm gì nếu đã đạt mục tiêu hoặc đã hết giờ
    if (clawState === CLAW_STATE.DONE || clawState === CLAW_STATE.LEVEL_CLEARED) {
        return;
    }

    timeLeft--;
    timerText.setText(`Thời gian: ${timeLeft}`);

    if (timeLeft <= 0) {
        timeLeft = 0;
        timerText.setText('Thời gian: 0');
        // Chỉ gọi endLevel nếu chưa ở trạng thái DONE hoặc LEVEL_CLEARED
        if (clawState !== CLAW_STATE.DONE && clawState !== CLAW_STATE.LEVEL_CLEARED) {
             endLevel(this); // Gọi hàm kết thúc do hết giờ
        }
    }
}

// --- HÀM MỚI: Hiển thị màn hình khi đạt mục tiêu sớm ---
function showLevelClearedScreen(scene) {
    console.log("Showing Level Cleared Screen");

    // Nền mờ
    const backgroundOverlay = scene.add.graphics();
    backgroundOverlay.fillStyle(0x000000, 0.7);
    backgroundOverlay.fillRect(0, 0, config.width, config.height);
    backgroundOverlay.setDepth(9);

    // Thông báo
    const message = `MỤC TIÊU ĐẠT!\nĐiểm: ${score}\nThời gian còn lại: ${timeLeft}`;
    const clearText = scene.add.text(config.width / 2, config.height / 2 - 50, message, {
        fontSize: '32px',
        fill: '#00FF00', // Màu xanh lá
        align: 'center',
        wordWrap: { width: config.width * 0.8 },
        padding: { x: 20, y: 10 }
    }).setOrigin(0.5);
    clearText.setDepth(10);

    // Nút Tiếp tục
    const continueButton = scene.add.text(config.width / 2, config.height / 2 + 60, 'Tiếp Tục', {
        fontSize: '28px',
        fill: '#fff',
        backgroundColor: '#4CAF50', // Xanh lá
        padding: { x: 20, y: 10 },
        fontStyle: 'bold'
    })
    .setOrigin(0.5)
    .setDepth(11)
    .setInteractive({ useHandCursor: true });

    // Hành động khi nhấn nút Tiếp tục
    continueButton.once('pointerdown', () => {
        console.log("Continuing to next level...");
        // Chuẩn bị cho màn tiếp theo
        currentLevel++;
        goal = Math.floor(goal * 1.5 + currentLevel * 50);
        score = 0; // Reset điểm
        timeLeft = 60; // Reset thời gian
        scene.scene.restart(); // Khởi động lại Scene
    });

    // Hiệu ứng hover
    continueButton.on('pointerover', () => {
        continueButton.setBackgroundColor('#555');
    });
    continueButton.on('pointerout', () => {
        continueButton.setBackgroundColor('#4CAF50');
    });
}


// --- Hàm EndLevel (Khi hết giờ) ---
function endLevel(scene) {
    // Không chạy nếu đã đạt mục tiêu trước đó
    if (clawState === CLAW_STATE.LEVEL_CLEARED) {
        console.log("endLevel called but level was already cleared.");
        return;
    }
    // Đảm bảo chỉ chạy một lần khi hết giờ
    if (clawState === CLAW_STATE.DONE) return;

    console.log("Level ended due to time out!");
    clawState = CLAW_STATE.DONE; // Đặt trạng thái hết giờ
    claw.body.setVelocity(0, 0);
    // timer đã paused sẵn trong updateTimer khi timeLeft <= 0

    let message = "";
    let messageColor = '#FF0000'; // Mặc định thua

    // Nền mờ
    const backgroundOverlay = scene.add.graphics();
    backgroundOverlay.fillStyle(0x000000, 0.7);
    backgroundOverlay.fillRect(0, 0, config.width, config.height);
    backgroundOverlay.setDepth(9);

    // Thông báo chính
    const endText = scene.add.text(config.width / 2, config.height / 2 - 50, '', {
        fontSize: '32px', fill: '#fff', align: 'center',
        wordWrap: { width: config.width * 0.8 }, padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(10);

    // Nút hành động
    const actionButton = scene.add.text(config.width / 2, config.height / 2 + 60, '', {
        fontSize: '28px', fill: '#fff', backgroundColor: '#ddd',
        padding: { x: 20, y: 10 }, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

    // Kiểm tra thắng/thua KHI HẾT GIỜ
    if (score >= goal) { // THẮNG (khi hết giờ) - Trường hợp hiếm nhưng có thể xảy ra
        message = `HẾT GIỜ!\n(Nhưng vẫn đạt mục tiêu!)\nĐiểm: ${score}\nMục tiêu: ${goal}`;
        messageColor = '#00FF00'; // Xanh lá
        endText.setColor(messageColor);
        endText.setText(message);

        actionButton.setText('Màn Tiếp Theo');
        actionButton.setBackgroundColor('#4CAF50');

        actionButton.once('pointerdown', () => {
            currentLevel++;
            goal = Math.floor(goal * 1.5 + currentLevel * 50);
            score = 0;
            timeLeft = 60;
            scene.scene.restart();
        });

    } else { // THUA (khi hết giờ)
        message = `HẾT GIỜ!\nTHUA RỒI!\nĐiểm: ${score}\nMục tiêu: ${goal}`;
        messageColor = '#FF0000'; // Đỏ
        endText.setColor(messageColor);
        endText.setText(message);

        actionButton.setText('Thử Lại');
        actionButton.setBackgroundColor('#f44336');

        actionButton.once('pointerdown', () => {
            score = 0;
            timeLeft = 60;
            scene.scene.restart();
        });
    }

    // Hiệu ứng hover
    actionButton.on('pointerover', () => actionButton.setBackgroundColor('#555'));
    actionButton.on('pointerout', () => {
        actionButton.setBackgroundColor(score >= goal ? '#4CAF50' : '#f44336');
    });
}