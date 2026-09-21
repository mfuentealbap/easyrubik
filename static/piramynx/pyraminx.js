(() => {
    const canvas = document.getElementById("stage");

    if (!canvas) {
        console.error("No se encontró #stage");
        return;
    }

    const gl = canvas.getContext("webgl", {
        antialias: true,
        alpha: true
    });

    if (!gl) {
        console.error("WebGL no disponible");
        return;
    }

    // =========================================================
    // SHADERS
    // =========================================================

    const vertexShaderSource = `
        attribute vec3 aPosition;
        attribute vec3 aColor;

        uniform mat4 uMatrix;

        varying vec3 vColor;

        void main() {
            gl_Position = uMatrix * vec4(aPosition, 1.0);
            vColor = aColor;
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;

        varying vec3 vColor;

        void main() {
            gl_FragColor = vec4(vColor, 1.0);
        }
    `;

    function createShader(type, source) {
        const shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }

    const vertexShader =
        createShader(gl.VERTEX_SHADER, vertexShaderSource);

    const fragmentShader =
        createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
        return;
    }

    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return;
    }

    gl.useProgram(program);

    const aPosition =
        gl.getAttribLocation(program, "aPosition");

    const aColor =
        gl.getAttribLocation(program, "aColor");

    const uMatrix =
        gl.getUniformLocation(program, "uMatrix");

    // =========================================================
    // MATRICES
    // =========================================================

    function perspective(fov, aspect, near, far) {

        const f = 1 / Math.tan(fov / 2);

        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) / (near - far), -1,
            0, 0, (2 * far * near) / (near - far), 0
        ]);
    }

    function rotationX(a) {

        const c = Math.cos(a);
        const s = Math.sin(a);

        return new Float32Array([
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ]);
    }

    function rotationY(a) {

        const c = Math.cos(a);
        const s = Math.sin(a);

        return new Float32Array([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ]);
    }

    function multiply(a, b) {

        const out = new Float32Array(16);

        for (let col = 0; col < 4; col++) {

            for (let row = 0; row < 4; row++) {

                out[col * 4 + row] =
                    a[0 * 4 + row] * b[col * 4 + 0] +
                    a[1 * 4 + row] * b[col * 4 + 1] +
                    a[2 * 4 + row] * b[col * 4 + 2] +
                    a[3 * 4 + row] * b[col * 4 + 3];
            }
        }

        return out;
    }

    function translation(x, y, z) {

        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ]);
    }

    // =========================================================
    // GEOMETRÍA DEL PYRAMINX
    // =========================================================

    /*
        Vértices principales

                 A
                / \
               /   \
              /     \
             B-------C
              \     /
               \   /
                \ /
                 D
    */

    const A = [0, 1.5, 0];
    const B = [-1.35, -0.8, 0.9];
    const C = [1.35, -0.8, 0.9];
    const D = [0, -0.8, -1.2];

    /*
        Colores oficiales aproximados:

        Rojo
        Azul
        Verde
        Amarillo
    */

    const RED = [0.95, 0.06, 0.06];
    const BLUE = [0.05, 0.32, 0.95];
    const GREEN = [0.04, 0.78, 0.28];
    const YELLOW = [0.95, 0.72, 0.04];

    const DARK = [0.015, 0.015, 0.02];

    const vertices = [];
    const colors = [];

    // =========================================================
    // TRIÁNGULOS
    // =========================================================

    function addTriangle(p1, p2, p3, color) {

        vertices.push(
            ...p1,
            ...p2,
            ...p3
        );

        colors.push(
            ...color,
            ...color,
            ...color
        );
    }

    // =========================================================
    // INTERPOLACIÓN
    // =========================================================

    function lerp(a, b, t) {

        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ];
    }

    /*
        Genera una cara triangular dividida en piezas.

        n = 3

                 A
                / \
               /___\
              / \ / \
             /___V___\
    */

    function generateFace(A, B, C, faceColor) {

        const n = 3;

        const rows = [];

        for (let row = 0; row <= n; row++) {

            const t = row / n;

            const left = lerp(A, B, t);
            const right = lerp(A, C, t);

            const points = [];

            for (let col = 0; col <= row; col++) {

                const u =
                    row === 0
                        ? 0
                        : col / row;

                points.push(
                    lerp(left, right, u)
                );
            }

            rows.push(points);
        }

        // Triángulos hacia arriba
        for (let row = 0; row < n; row++) {

            for (let col = 0; col <= row; col++) {

                const p1 = rows[row][col];

                const p2 =
                    rows[row + 1][col];

                const p3 =
                    rows[row + 1][col + 1];

                addTriangle(
                    p1,
                    p2,
                    p3,
                    faceColor
                );
            }
        }

        // Triángulos hacia abajo
        for (let row = 1; row < n; row++) {

            for (let col = 0; col < row; col++) {

                const p1 =
                    rows[row][col];

                const p2 =
                    rows[row + 1][col];

                const p3 =
                    rows[row][col + 1];

                addTriangle(
                    p1,
                    p2,
                    p3,
                    faceColor
                );
            }
        }
    }

    // =========================================================
    // CREAR LAS 4 CARAS
    // =========================================================

    generateFace(
        A,
        B,
        C,
        RED
    );

    generateFace(
        A,
        C,
        D,
        BLUE
    );

    generateFace(
        A,
        D,
        B,
        GREEN
    );

    generateFace(
        B,
        D,
        C,
        YELLOW
    );

    // =========================================================
    // LÍNEAS OSCURAS ENTRE PIEZAS
    // =========================================================

    /*
        Dibujamos pequeñas líneas oscuras
        sobre los bordes para que cada
        pieza quede visualmente separada.
    */

    function addLine(a, b, width = 0.018) {

        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];

        const len =
            Math.sqrt(
                dx * dx +
                dy * dy +
                dz * dz
            );

        if (len === 0) return;

        const ox = (-dy / len) * width;
        const oy = (dx / len) * width;

        const p1 = [
            a[0] + ox,
            a[1] + oy,
            a[2]
        ];

        const p2 = [
            b[0] + ox,
            b[1] + oy,
            b[2]
        ];

        addTriangle(
            a,
            b,
            p1,
            DARK
        );

        addTriangle(
            b,
            p1,
            p2,
            DARK
        );
    }

    // =========================================================
    // BUFFERS
    // =========================================================

    const positionBuffer =
        gl.createBuffer();

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        positionBuffer
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW
    );

    const colorBuffer =
        gl.createBuffer();

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        colorBuffer
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(colors),
        gl.STATIC_DRAW
    );

    // =========================================================
    // CÁMARA
    // =========================================================

    let yaw = 0.6;
    let pitch = -0.25;
    let distance = 5;

    let dragging = false;

    let lastX = 0;
    let lastY = 0;

    // =========================================================
    // RESIZE
    // =========================================================

    function resize() {

        const rect =
            canvas.getBoundingClientRect();

        const width =
            Math.max(
                1,
                Math.floor(rect.width)
            );

        const height =
            Math.max(
                1,
                Math.floor(rect.height)
            );

        if (
            canvas.width !== width ||
            canvas.height !== height
        ) {
            canvas.width = width;
            canvas.height = height;
        }

        gl.viewport(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    // =========================================================
    // RENDER
    // =========================================================

    function render() {

        resize();

        gl.enable(gl.DEPTH_TEST);

        gl.disable(gl.CULL_FACE);

        gl.clearColor(
            0.025,
            0.03,
            0.05,
            1
        );

        gl.clear(
            gl.COLOR_BUFFER_BIT |
            gl.DEPTH_BUFFER_BIT
        );

        const aspect =
            canvas.width /
            canvas.height;

        const projection =
            perspective(
                Math.PI / 4,
                aspect,
                0.1,
                100
            );

        const rx =
            rotationX(pitch);

        const ry =
            rotationY(yaw);

        const rotation =
            multiply(
                rx,
                ry
            );

        const move =
            translation(
                0,
                0,
                -distance
            );

        const model =
            multiply(
                move,
                rotation
            );

        const matrix =
            multiply(
                projection,
                model
            );

        gl.uniformMatrix4fv(
            uMatrix,
            false,
            matrix
        );

        // Posiciones
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            positionBuffer
        );

        gl.enableVertexAttribArray(
            aPosition
        );

        gl.vertexAttribPointer(
            aPosition,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );

        // Colores
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            colorBuffer
        );

        gl.enableVertexAttribArray(
            aColor
        );

        gl.vertexAttribPointer(
            aColor,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );

        gl.drawArrays(
            gl.TRIANGLES,
            0,
            vertices.length / 3
        );

        requestAnimationFrame(
            render
        );
    }

    // =========================================================
    // ROTACIÓN CON MOUSE / TOUCH
    // =========================================================

    canvas.addEventListener(
        "pointerdown",
        (event) => {

            dragging = true;

            lastX =
                event.clientX;

            lastY =
                event.clientY;

            canvas.setPointerCapture(
                event.pointerId
            );
        }
    );

    canvas.addEventListener(
        "pointermove",
        (event) => {

            if (!dragging) return;

            const dx =
                event.clientX - lastX;

            const dy =
                event.clientY - lastY;

            yaw +=
                dx * 0.01;

            pitch +=
                dy * 0.01;

            pitch =
                Math.max(
                    -1.4,
                    Math.min(
                        1.4,
                        pitch
                    )
                );

            lastX =
                event.clientX;

            lastY =
                event.clientY;
        }
    );

    canvas.addEventListener(
        "pointerup",
        () => {
            dragging = false;
        }
    );

    canvas.addEventListener(
        "pointercancel",
        () => {
            dragging = false;
        }
    );

    // =========================================================
    // ZOOM
    // =========================================================

    canvas.addEventListener(
        "wheel",
        (event) => {

            event.preventDefault();

            distance +=
                event.deltaY * 0.005;

            distance =
                Math.max(
                    3,
                    Math.min(
                        9,
                        distance
                    )
                );
        },
        {
            passive: false
        }
    );

    // =========================================================
    // RESET
    // =========================================================

    const resetButton =
        document.getElementById(
            "btnReset"
        );

    if (resetButton) {

        resetButton.addEventListener(
            "click",
            () => {

                yaw = 0.6;
                pitch = -0.25;
                distance = 5;
            }
        );
    }

    // =========================================================
    // ESTADO
    // =========================================================

    const status =
        document.getElementById(
            "status"
        );

    if (status) {

        status.textContent =
            "✅ Pyraminx listo";
    }

    // =========================================================
    // INICIAR
    // =========================================================

    console.log(
        "Pyraminx por piezas iniciado"
    );

    render();

})();