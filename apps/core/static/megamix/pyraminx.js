(() => {
    "use strict";

    // ============================================================
    // easyRubik — PYRAMINX V2.1
    // PARTE 1/3
    //
    // Geometría + piezas + puntas + WebGL + render mejorado
    // ============================================================


    // ============================================================
    // 1. CANVAS / WEBGL
    // ============================================================

    const canvas = document.getElementById("stage");

    if (!canvas) {
        console.error("easyRubik: no existe #stage");
        return;
    }

    const gl = canvas.getContext("webgl", {
        antialias: true,
        alpha: true,
        depth: true,
        premultipliedAlpha: false
    });

    if (!gl) {
        console.error("easyRubik: WebGL no disponible");
        return;
    }


    // ============================================================
    // 2. ELEMENTOS HTML
    // ============================================================

    const statusEl =
        document.getElementById("status");

    const moveCounterEl =
        document.getElementById("moveCounter");

    const btnScramble =
        document.getElementById("btnScramble");

    const btnSolve =
        document.getElementById("btnSolve");

    const btnReset =
        document.getElementById("btnReset");

    const btnStop =
        document.getElementById("btnStop");

    const moveButtons =
        document.querySelectorAll("[data-move]");


    function setStatus(text) {
        if (statusEl) {
            statusEl.textContent = text;
        }
    }


    // ============================================================
    // 3. CONSTANTES
    // ============================================================

    const PI = Math.PI;
    const DEG = PI / 180;

    const TURN_ANGLE =
        120 * DEG;

    const COLORS = {

        red: [
            0.95,
            0.045,
            0.055
        ],

        yellow: [
            1.00,
            0.79,
            0.015
        ],

        green: [
            0.02,
            0.70,
            0.27
        ],

        blue: [
            0.025,
            0.29,
            0.94
        ],

        plastic: [
            0.014,
            0.016,
            0.022
        ],

        plasticSide: [
            0.035,
            0.039,
            0.050
        ]
    };


    const PUZZLE_RADIUS =
        1.85;

    const STICKER_SCALE =
        0.895;

    const STICKER_LIFT =
        0.024;

    const BODY_DEPTH =
        0.080;


    // ============================================================
    // 4. MATEMÁTICA DE VECTORES
    // ============================================================

    function cloneVec(v) {
        return [
            v[0],
            v[1],
            v[2]
        ];
    }


    function add(a, b) {
        return [
            a[0] + b[0],
            a[1] + b[1],
            a[2] + b[2]
        ];
    }


    function sub(a, b) {
        return [
            a[0] - b[0],
            a[1] - b[1],
            a[2] - b[2]
        ];
    }


    function scale(v, s) {
        return [
            v[0] * s,
            v[1] * s,
            v[2] * s
        ];
    }


    function dot(a, b) {
        return (
            a[0] * b[0] +
            a[1] * b[1] +
            a[2] * b[2]
        );
    }


    function cross(a, b) {
        return [
            a[1] * b[2] -
            a[2] * b[1],

            a[2] * b[0] -
            a[0] * b[2],

            a[0] * b[1] -
            a[1] * b[0]
        ];
    }


    function lengthVec(v) {
        return Math.sqrt(
            dot(v, v)
        );
    }


    function normalize(v) {

        const length =
            lengthVec(v);

        if (length < 0.000001) {
            return [0, 0, 0];
        }

        return scale(
            v,
            1 / length
        );
    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.max(
            min,
            Math.min(
                max,
                value
            )
        );
    }


    function centroid3(
        a,
        b,
        c
    ) {

        return [
            (
                a[0] +
                b[0] +
                c[0]
            ) / 3,

            (
                a[1] +
                b[1] +
                c[1]
            ) / 3,

            (
                a[2] +
                b[2] +
                c[2]
            ) / 3
        ];
    }


    function centroidPoints(points) {

        if (!points.length) {
            return [0, 0, 0];
        }

        let x = 0;
        let y = 0;
        let z = 0;

        for (const point of points) {
            x += point[0];
            y += point[1];
            z += point[2];
        }

        return [
            x / points.length,
            y / points.length,
            z / points.length
        ];
    }


    // ============================================================
    // 5. ROTACIÓN DE RODRIGUES
    // ============================================================

    function rotateAroundAxis(
        point,
        axis,
        angle
    ) {

        const n =
            normalize(axis);

        const c =
            Math.cos(angle);

        const s =
            Math.sin(angle);


        const part1 =
            scale(
                point,
                c
            );


        const part2 =
            scale(
                cross(n, point),
                s
            );


        const part3 =
            scale(
                n,
                dot(n, point) *
                (1 - c)
            );


        return add(
            add(
                part1,
                part2
            ),
            part3
        );
    }


    // ============================================================
    // 6. TETRAEDRO REGULAR
    // ============================================================

    /*
                         U
                         ▲
                        / \
                       /   \
                      /     \
                     /       \
                    /_________\
                   L           R

                         B
                       detrás
    */


    const U_DIRECTION =
        normalize([
            0,
            1,
            0
        ]);


    const L_DIRECTION =
        normalize([
            -0.942809,
            -0.333333,
            0
        ]);


    const R_DIRECTION =
        normalize([
            0.471405,
            -0.333333,
            0.816497
        ]);


    const B_DIRECTION =
        normalize([
            0.471405,
            -0.333333,
            -0.816497
        ]);


    const VERTICES = {

        U:
            scale(
                U_DIRECTION,
                PUZZLE_RADIUS
            ),

        L:
            scale(
                L_DIRECTION,
                PUZZLE_RADIUS
            ),

        R:
            scale(
                R_DIRECTION,
                PUZZLE_RADIUS
            ),

        B:
            scale(
                B_DIRECTION,
                PUZZLE_RADIUS
            )
    };


    const MOVE_AXES = {

        U:
            normalize(
                VERTICES.U
            ),

        L:
            normalize(
                VERTICES.L
            ),

        R:
            normalize(
                VERTICES.R
            ),

        B:
            normalize(
                VERTICES.B
            )
    };


    // ============================================================
    // 7. CARAS
    // ============================================================

    const FACE_DEFINITIONS = [

        {
            id: "front",

            vertices: [
                VERTICES.U,
                VERTICES.L,
                VERTICES.R
            ],

            color:
                COLORS.red
        },


        {
            id: "right",

            vertices: [
                VERTICES.U,
                VERTICES.R,
                VERTICES.B
            ],

            color:
                COLORS.blue
        },


        {
            id: "left",

            vertices: [
                VERTICES.U,
                VERTICES.B,
                VERTICES.L
            ],

            color:
                COLORS.green
        },


        {
            id: "bottom",

            vertices: [
                VERTICES.L,
                VERTICES.B,
                VERTICES.R
            ],

            color:
                COLORS.yellow
        }
    ];


    // ============================================================
    // 8. NORMAL EXTERIOR
    // ============================================================

    function outwardNormal(
        a,
        b,
        c
    ) {

        let normal =
            normalize(
                cross(
                    sub(b, a),
                    sub(c, a)
                )
            );


        const center =
            centroid3(
                a,
                b,
                c
            );


        if (
            dot(
                normal,
                center
            ) < 0
        ) {

            normal =
                scale(
                    normal,
                    -1
                );
        }


        return normal;
    }


    // ============================================================
    // 9. COORDENADAS BARICÉNTRICAS
    // ============================================================

    function barycentricPoint(
        a,
        b,
        c,
        wa,
        wb,
        wc
    ) {

        return [

            a[0] * wa +
            b[0] * wb +
            c[0] * wc,

            a[1] * wa +
            b[1] * wb +
            c[1] * wc,

            a[2] * wa +
            b[2] * wb +
            c[2] * wc
        ];
    }


    // ============================================================
    // 10. SUBDIVISIÓN DE CARA
    // ============================================================

    function subdivideFace(
        a,
        b,
        c
    ) {

        const N = 3;

        const grid = [];


        for (
            let row = 0;
            row <= N;
            row++
        ) {

            grid[row] = [];


            for (
                let col = 0;
                col <= N - row;
                col++
            ) {

                const wb =
                    row / N;

                const wc =
                    col / N;

                const wa =
                    1 - wb - wc;


                grid[row][col] =
                    barycentricPoint(
                        a,
                        b,
                        c,
                        wa,
                        wb,
                        wc
                    );
            }
        }


        const triangles = [];


        for (
            let row = 0;
            row < N;
            row++
        ) {

            for (
                let col = 0;
                col < N - row;
                col++
            ) {

                const p0 =
                    grid[row][col];

                const p1 =
                    grid[row + 1][col];

                const p2 =
                    grid[row][col + 1];


                triangles.push({

                    points: [
                        cloneVec(p0),
                        cloneVec(p1),
                        cloneVec(p2)
                    ],

                    row,
                    col,

                    inverted:
                        false
                });


                if (
                    col <
                    N - row - 1
                ) {

                    const p3 =
                        grid[
                            row + 1
                        ][
                            col + 1
                        ];


                    triangles.push({

                        points: [
                            cloneVec(p1),
                            cloneVec(p3),
                            cloneVec(p2)
                        ],

                        row,
                        col,

                        inverted:
                            true
                    });
                }
            }
        }


        return triangles;
    }


    // ============================================================
    // 11. ENCOGER TRIÁNGULO
    // ============================================================

    function shrinkTriangle(
        points,
        factor
    ) {

        const center =
            centroid3(
                points[0],
                points[1],
                points[2]
            );


        return points.map(
            point =>
                add(
                    center,
                    scale(
                        sub(
                            point,
                            center
                        ),
                        factor
                    )
                )
        );
    }


    // ============================================================
    // 12. COORDENADAS TETRAÉDRICAS
    // ============================================================

    function tetraCoordinates(point) {

        const radiusSquared =
            PUZZLE_RADIUS *
            PUZZLE_RADIUS;


        function weight(vertex) {

            return (
                1 +
                3 *
                (
                    dot(
                        point,
                        vertex
                    ) /
                    radiusSquared
                )
            ) / 4;
        }


        return {

            U:
                weight(
                    VERTICES.U
                ),

            L:
                weight(
                    VERTICES.L
                ),

            R:
                weight(
                    VERTICES.R
                ),

            B:
                weight(
                    VERTICES.B
                )
        };
    }


    // ============================================================
    // 13. PIEZA
    // ============================================================

    let pieceIdCounter = 0;


    function createPiece() {

        return {

            id:
                pieceIdCounter++,

            bodyTriangles:
                [],

            stickers:
                [],

            center:
                [0, 0, 0],

            tetra:
                null,

            layers:
                new Set(),

            /*
                NUEVO V2.1

                tip:
                    null
                    "U"
                    "L"
                    "R"
                    "B"

                Si tiene valor, esta pieza pertenece físicamente
                a una de las cuatro puntas.
            */

            tip:
                null
        };
    }


    let pieces = [];

    const pieceMap =
        new Map();


    // ============================================================
    // 14. AGRUPACIÓN DE PIEZAS
    // ============================================================

    function quantize(value) {

        return (
            Math.round(
                value * 100
            ) / 100
        );
    }


    function pieceKeyFromCenter(center) {

        const direction =
            normalize(center);


        return [
            quantize(
                direction[0]
            ),

            quantize(
                direction[1]
            ),

            quantize(
                direction[2]
            )
        ].join("|");
    }


    // ============================================================
    // 15. CUERPO NEGRO
    // ============================================================

    function createStickerBody(
        points,
        normal
    ) {

        const front =
            shrinkTriangle(
                points,
                0.965
            );


        const back =
            front.map(
                point =>
                    add(
                        point,
                        scale(
                            normal,
                            -BODY_DEPTH
                        )
                    )
            );


        const triangles = [];


        // Frente
        triangles.push({

            points: [
                cloneVec(front[0]),
                cloneVec(front[1]),
                cloneVec(front[2])
            ],

            color:
                [...COLORS.plastic]
        });


        // Fondo
        triangles.push({

            points: [
                cloneVec(back[2]),
                cloneVec(back[1]),
                cloneVec(back[0])
            ],

            color:
                [...COLORS.plastic]
        });


        // Laterales
        for (
            let i = 0;
            i < 3;
            i++
        ) {

            const next =
                (i + 1) % 3;


            triangles.push({

                points: [
                    cloneVec(front[i]),
                    cloneVec(back[i]),
                    cloneVec(back[next])
                ],

                color:
                    [...COLORS.plasticSide]
            });


            triangles.push({

                points: [
                    cloneVec(front[i]),
                    cloneVec(back[next]),
                    cloneVec(front[next])
                ],

                color:
                    [...COLORS.plasticSide]
            });
        }


        return triangles;
    }


    // ============================================================
    // 16. ACTUALIZAR CENTRO DE PIEZA
    // ============================================================

    function updatePieceCenter(piece) {

        const points = [];


        for (
            const sticker
            of piece.stickers
        ) {

            for (
                const point
                of sticker.points
            ) {

                points.push(
                    point
                );
            }
        }


        if (!points.length) {

            for (
                const triangle
                of piece.bodyTriangles
            ) {

                for (
                    const point
                    of triangle.points
                ) {

                    points.push(
                        point
                    );
                }
            }
        }


        piece.center =
            centroidPoints(
                points
            );


        piece.tetra =
            tetraCoordinates(
                piece.center
            );
    }


    function updateAllPieceCenters() {

        for (
            const piece
            of pieces
        ) {

            updatePieceCenter(
                piece
            );
        }
    }


    // ============================================================
    // 17. IDENTIFICAR PUNTAS
    // ============================================================

    /*
        Una punta es la región que está más cerca de UNO de los
        cuatro vértices.

        IMPORTANTE:

        No usaremos esta detección durante cada frame.

        Se utiliza para identificar la pieza física y después
        piece.tip viaja con ella.
    */


    const TIP_THRESHOLD =
        0.70;


    function detectTip(piece) {

        if (!piece.tetra) {
            return null;
        }


        let bestName =
            null;

        let bestValue =
            -Infinity;


        for (
            const name
            of ["U", "L", "R", "B"]
        ) {

            const value =
                piece.tetra[name];


            if (
                value >
                bestValue
            ) {

                bestValue =
                    value;

                bestName =
                    name;
            }
        }


        if (
            bestValue >=
            TIP_THRESHOLD
        ) {

            return bestName;
        }


        return null;
    }


    function identifyTips() {

        updateAllPieceCenters();


        for (
            const piece
            of pieces
        ) {

            piece.tip =
                detectTip(
                    piece
                );
        }
    }


    // ============================================================
    // 18. CONSTRUIR PYRAMINX
    // ============================================================

    function buildPuzzle() {

        pieces = [];

        pieceMap.clear();

        pieceIdCounter = 0;


        for (
            let faceIndex = 0;
            faceIndex <
            FACE_DEFINITIONS.length;
            faceIndex++
        ) {

            const face =
                FACE_DEFINITIONS[
                    faceIndex
                ];


            const [
                a,
                b,
                c
            ] = face.vertices;


            const normal =
                outwardNormal(
                    a,
                    b,
                    c
                );


            const subdivisions =
                subdivideFace(
                    a,
                    b,
                    c
                );


            for (
                const subdivision
                of subdivisions
            ) {

                const surfaceCenter =
                    centroid3(
                        subdivision.points[0],
                        subdivision.points[1],
                        subdivision.points[2]
                    );


                const key =
                    pieceKeyFromCenter(
                        surfaceCenter
                    );


                let piece =
                    pieceMap.get(
                        key
                    );


                if (!piece) {

                    piece =
                        createPiece();


                    pieceMap.set(
                        key,
                        piece
                    );


                    pieces.push(
                        piece
                    );
                }


                // -----------------------------------------------
                // STICKER
                // -----------------------------------------------

                const stickerBase =
                    shrinkTriangle(
                        subdivision.points,
                        STICKER_SCALE
                    );


                const stickerPoints =
                    stickerBase.map(
                        point =>
                            add(
                                point,
                                scale(
                                    normal,
                                    STICKER_LIFT
                                )
                            )
                    );


                piece.stickers.push({

                    faceId:
                        face.id,

                    faceIndex,

                    row:
                        subdivision.row,

                    col:
                        subdivision.col,

                    inverted:
                        subdivision.inverted,

                    color:
                        [...face.color],

                    normal:
                        cloneVec(normal),

                    points:
                        stickerPoints.map(
                            cloneVec
                        )
                });


                // -----------------------------------------------
                // PLÁSTICO DE LA MISMA PIEZA
                // -----------------------------------------------

                const body =
                    createStickerBody(
                        subdivision.points,
                        normal
                    );


                for (
                    const triangle
                    of body
                ) {

                    piece.bodyTriangles.push({

                        points:
                            triangle.points.map(
                                cloneVec
                            ),

                        color:
                            [...triangle.color]
                    });
                }
            }
        }


        updateAllPieceCenters();

        identifyTips();
    }


    // ============================================================
    // 19. OBTENER PUNTA
    // ============================================================

    function getTipPiece(
        tipName
    ) {

        return pieces.find(
            piece =>
                piece.tip ===
                tipName
        ) || null;
    }


    // ============================================================
    // 20. DEBUG DE PUNTAS
    // ============================================================

    function debugTips() {

        const data = {};


        for (
            const name
            of ["U", "L", "R", "B"]
        ) {

            const piece =
                getTipPiece(
                    name
                );


            data[name] =
                piece
                    ? {
                        id:
                            piece.id,

                        stickers:
                            piece.stickers.length,

                        tetra:
                            JSON.stringify(
                                piece.tetra
                            )
                    }
                    : {
                        id:
                            "NO ENCONTRADA",

                        stickers:
                            0,

                        tetra:
                            "-"
                    };
        }


        console.table(data);

        return data;
    }


    // ============================================================
    // 21. MATRICES
    // ============================================================

    function mat4Multiply(
        a,
        b
    ) {

        const out =
            new Float32Array(16);


        for (
            let col = 0;
            col < 4;
            col++
        ) {

            for (
                let row = 0;
                row < 4;
                row++
            ) {

                out[
                    col * 4 + row
                ] =

                    a[
                        row
                    ] *
                    b[
                        col * 4
                    ]

                    +

                    a[
                        4 + row
                    ] *
                    b[
                        col * 4 + 1
                    ]

                    +

                    a[
                        8 + row
                    ] *
                    b[
                        col * 4 + 2
                    ]

                    +

                    a[
                        12 + row
                    ] *
                    b[
                        col * 4 + 3
                    ];
            }
        }


        return out;
    }


    function mat4Perspective(
        fov,
        aspect,
        near,
        far
    ) {

        const f =
            1 /
            Math.tan(
                fov / 2
            );


        const nf =
            1 /
            (near - far);


        return new Float32Array([

            f / aspect,
            0,
            0,
            0,

            0,
            f,
            0,
            0,

            0,
            0,
            (far + near) * nf,
            -1,

            0,
            0,
            (
                2 *
                far *
                near
            ) * nf,
            0
        ]);
    }


    function mat4Translation(
        x,
        y,
        z
    ) {

        return new Float32Array([

            1, 0, 0, 0,

            0, 1, 0, 0,

            0, 0, 1, 0,

            x, y, z, 1
        ]);
    }


    function mat4RotationX(
        angle
    ) {

        const c =
            Math.cos(angle);

        const s =
            Math.sin(angle);


        return new Float32Array([

            1, 0, 0, 0,

            0, c, s, 0,

            0, -s, c, 0,

            0, 0, 0, 1
        ]);
    }


    function mat4RotationY(
        angle
    ) {

        const c =
            Math.cos(angle);

        const s =
            Math.sin(angle);


        return new Float32Array([

            c, 0, -s, 0,

            0, 1, 0, 0,

            s, 0, c, 0,

            0, 0, 0, 1
        ]);
    }


    // ============================================================
    // 22. SHADERS V2.1
    // ============================================================

    /*
        Añadimos una iluminación sencilla.

        No cambia la mecánica del Pyraminx.
        Solo evita que todo parezca completamente plano.
    */


    const vertexShaderSource = `

        attribute vec3 aPosition;
        attribute vec3 aColor;
        attribute vec3 aNormal;

        uniform mat4 uMatrix;

        varying vec3 vColor;
        varying vec3 vNormal;

        void main() {

            gl_Position =
                uMatrix *
                vec4(
                    aPosition,
                    1.0
                );

            vColor =
                aColor;

            vNormal =
                aNormal;
        }
    `;


    const fragmentShaderSource = `

        precision mediump float;

        varying vec3 vColor;
        varying vec3 vNormal;

        void main() {

            vec3 normal =
                normalize(
                    vNormal
                );

            vec3 lightDirection =
                normalize(
                    vec3(
                        -0.35,
                        0.75,
                        0.55
                    )
                );

            float diffuse =
                max(
                    dot(
                        normal,
                        lightDirection
                    ),
                    0.0
                );

            float lighting =
                0.72 +
                diffuse * 0.28;

            vec3 finalColor =
                vColor *
                lighting;

            gl_FragColor =
                vec4(
                    finalColor,
                    1.0
                );
        }
    `;


    function compileShader(
        type,
        source
    ) {

        const shader =
            gl.createShader(type);


        gl.shaderSource(
            shader,
            source
        );


        gl.compileShader(
            shader
        );


        if (
            !gl.getShaderParameter(
                shader,
                gl.COMPILE_STATUS
            )
        ) {

            console.error(
                gl.getShaderInfoLog(
                    shader
                )
            );

            gl.deleteShader(
                shader
            );

            return null;
        }


        return shader;
    }


    const vertexShader =
        compileShader(
            gl.VERTEX_SHADER,
            vertexShaderSource
        );


    const fragmentShader =
        compileShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource
        );


    if (
        !vertexShader ||
        !fragmentShader
    ) {
        return;
    }


    const program =
        gl.createProgram();


    gl.attachShader(
        program,
        vertexShader
    );


    gl.attachShader(
        program,
        fragmentShader
    );


    gl.linkProgram(
        program
    );


    if (
        !gl.getProgramParameter(
            program,
            gl.LINK_STATUS
        )
    ) {

        console.error(
            gl.getProgramInfoLog(
                program
            )
        );

        return;
    }


    gl.useProgram(
        program
    );


    const aPosition =
        gl.getAttribLocation(
            program,
            "aPosition"
        );


    const aColor =
        gl.getAttribLocation(
            program,
            "aColor"
        );


    const aNormal =
        gl.getAttribLocation(
            program,
            "aNormal"
        );


    const uMatrix =
        gl.getUniformLocation(
            program,
            "uMatrix"
        );


    // ============================================================
    // 23. BUFFERS
    // ============================================================

    const positionBuffer =
        gl.createBuffer();

    const colorBuffer =
        gl.createBuffer();

    const normalBuffer =
        gl.createBuffer();


    let vertexCount = 0;


    // ============================================================
    // 24. NORMAL DE TRIÁNGULO
    // ============================================================

    function triangleNormal(points) {

        return outwardNormal(
            points[0],
            points[1],
            points[2]
        );
    }


    // ============================================================
    // 25. SUBIR GEOMETRÍA
    // ============================================================

    function uploadGeometry() {

        const positions = [];
        const colors = [];
        const normals = [];


        // --------------------------------------------------------
        // PLÁSTICO
        // --------------------------------------------------------

        for (
            const piece
            of pieces
        ) {

            for (
                const triangle
                of piece.bodyTriangles
            ) {

                const normal =
                    triangleNormal(
                        triangle.points
                    );


                for (
                    const point
                    of triangle.points
                ) {

                    positions.push(
                        point[0],
                        point[1],
                        point[2]
                    );


                    colors.push(
                        triangle.color[0],
                        triangle.color[1],
                        triangle.color[2]
                    );


                    normals.push(
                        normal[0],
                        normal[1],
                        normal[2]
                    );
                }
            }
        }


        // --------------------------------------------------------
        // STICKERS
        // --------------------------------------------------------

        for (
            const piece
            of pieces
        ) {

            for (
                const sticker
                of piece.stickers
            ) {

                for (
                    const point
                    of sticker.points
                ) {

                    positions.push(
                        point[0],
                        point[1],
                        point[2]
                    );


                    colors.push(
                        sticker.color[0],
                        sticker.color[1],
                        sticker.color[2]
                    );


                    normals.push(
                        sticker.normal[0],
                        sticker.normal[1],
                        sticker.normal[2]
                    );
                }
            }
        }


        vertexCount =
            positions.length / 3;


        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            positionBuffer
        );


        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(
                positions
            ),
            gl.DYNAMIC_DRAW
        );


        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            colorBuffer
        );


        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(
                colors
            ),
            gl.DYNAMIC_DRAW
        );


        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            normalBuffer
        );


        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(
                normals
            ),
            gl.DYNAMIC_DRAW
        );
    }


    // ============================================================
    // 26. CÁMARA
    // ============================================================

    let cameraYaw =
        0.52;

    let cameraPitch =
        -0.15;

    let cameraDistance =
        5.6;


    let targetYaw =
        cameraYaw;

    let targetPitch =
        cameraPitch;

    let targetDistance =
        cameraDistance;


    // ============================================================
    // 27. VIEW PROJECTION
    // ============================================================

    function getViewProjectionMatrix() {

        const aspect =
            canvas.width /
            Math.max(
                1,
                canvas.height
            );


        const projection =
            mat4Perspective(
                42 * DEG,
                aspect,
                0.1,
                100
            );


        const rotationX =
            mat4RotationX(
                cameraPitch
            );


        const rotationY =
            mat4RotationY(
                cameraYaw
            );


        const rotation =
            mat4Multiply(
                rotationX,
                rotationY
            );


        const translation =
            mat4Translation(
                0,
                0,
                -cameraDistance
            );


        const view =
            mat4Multiply(
                translation,
                rotation
            );


        return mat4Multiply(
            projection,
            view
        );
    }


    // ============================================================
    // 28. RESIZE
    // ============================================================

    function resizeCanvas() {

        const rect =
            canvas.getBoundingClientRect();


        const dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );


        const width =
            Math.max(
                1,
                Math.round(
                    rect.width * dpr
                )
            );


        const height =
            Math.max(
                1,
                Math.round(
                    rect.height * dpr
                )
            );


        if (
            canvas.width !== width ||
            canvas.height !== height
        ) {

            canvas.width =
                width;

            canvas.height =
                height;
        }


        gl.viewport(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }


    // ============================================================
    // 29. DIBUJAR ESCENA
    // ============================================================

    function drawScene() {

        resizeCanvas();


        gl.enable(
            gl.DEPTH_TEST
        );


        gl.depthFunc(
            gl.LEQUAL
        );


        /*
            Seguimos sin CULL_FACE.

            Es importante durante las rotaciones porque podemos
            ver temporalmente laterales e interiores.
        */

        gl.disable(
            gl.CULL_FACE
        );


        gl.clearColor(
            0.018,
            0.023,
            0.034,
            1
        );


        gl.clear(
            gl.COLOR_BUFFER_BIT |
            gl.DEPTH_BUFFER_BIT
        );


        gl.useProgram(
            program
        );


        const matrix =
            getViewProjectionMatrix();


        gl.uniformMatrix4fv(
            uMatrix,
            false,
            matrix
        );


        // --------------------------------------------------------
        // POSICIÓN
        // --------------------------------------------------------

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


        // --------------------------------------------------------
        // COLOR
        // --------------------------------------------------------

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


        // --------------------------------------------------------
        // NORMAL
        // --------------------------------------------------------

        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            normalBuffer
        );


        gl.enableVertexAttribArray(
            aNormal
        );


        gl.vertexAttribPointer(
            aNormal,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );


        // --------------------------------------------------------
        // DRAW
        // --------------------------------------------------------

        gl.drawArrays(
            gl.TRIANGLES,
            0,
            vertexCount
        );
    }


    // ============================================================
    // 30. CONSTRUIR
    // ============================================================

    buildPuzzle();

    uploadGeometry();


    // ============================================================
    // 31. ESTADO DE MOVIMIENTOS
    // ============================================================

    /*
        Hay dos tipos de movimientos desde V2.1:

            "layer"
                U L R B

            "tip"
                u l r b

        Internamente NO mezclaremos ambas cosas.
    */


    let currentMove =
        null;


    let moveQueue =
        [];


    let moveHistory =
        [];


    let moveCounter =
        0;


    let stopped =
        false;


    const MOVE_DURATION =
        300;


    const TIP_MOVE_DURATION =
        220;


    function updateCounter() {

        if (moveCounterEl) {

            moveCounterEl.textContent =
                String(
                    moveCounter
                );
        }
    }


    // ============================================================
    // 32. DEBUG V2.1
    // ============================================================

    window.easyRubikPyraminxV21 = {

        info() {

            console.log(
                "🔺 easyRubik Pyraminx V2.1"
            );


            console.log(
                "Piezas:",
                pieces.length
            );


            console.log(
                "Stickers:",
                pieces.reduce(
                    (
                        total,
                        piece
                    ) =>
                        total +
                        piece.stickers.length,
                    0
                )
            );


            console.log(
                "Puntas:"
            );


            debugTips();
        },


        tips:
            debugTips,


        pieces() {

            return pieces.map(
                piece => ({

                    id:
                        piece.id,

                    tip:
                        piece.tip,

                    center:
                        [...piece.center],

                    tetra:
                        piece.tetra
                            ? {
                                ...piece.tetra
                            }
                            : null,

                    stickers:
                        piece.stickers.length,

                    layers:
                        [
                            ...piece.layers
                        ]
                })
            );
        }
    };


    // ============================================================
    // 33. ESTADO INICIAL
    // ============================================================

    updateCounter();


    setStatus(
        "Pyraminx V2.1 listo"
    );


    console.log(
        "========================================"
    );


    console.log(
        "🔺 easyRubik Pyraminx V2.1 — Parte 1 OK"
    );


    console.log(
        "Piezas:",
        pieces.length
    );


    console.log(
        "Puntas detectadas:"
    );


    debugTips();


    console.log(
        "========================================"
    );


    // ============================================================
    // NO CERRAR TODAVÍA
    //
    // NO pongas:
    //
    // })();
    //
    // PARTE 2/3 VA JUSTO DEBAJO.
    // ============================================================
        // ============================================================
    // easyRubik — PYRAMINX V2.1
    // PARTE 2/3
    //
    // Capas + puntas independientes + animaciones
    // + scramble + solve + reset
    // ============================================================


    // ============================================================
    // 34. UTILIDADES
    // ============================================================

    function cloneTriangle(points) {
        return points.map(
            point => cloneVec(point)
        );
    }


    function easeInOutCubic(t) {

        if (t < 0.5) {
            return 4 * t * t * t;
        }

        return (
            1 -
            Math.pow(
                -2 * t + 2,
                3
            ) / 2
        );
    }


    function snapNumber(value) {

        if (
            Math.abs(value) <
            0.0000001
        ) {
            return 0;
        }

        return (
            Math.round(
                value * 10000000
            ) / 10000000
        );
    }


    function snapVector(vector) {

        return [
            snapNumber(vector[0]),
            snapNumber(vector[1]),
            snapNumber(vector[2])
        ];
    }


    // ============================================================
    // 35. PARSEAR MOVIMIENTOS
    // ============================================================

    /*
        IMPORTANTE:

        MAYÚSCULAS:
            U L R B
            = capa completa

        minúsculas:
            u l r b
            = solamente la punta

        Ejemplos:

            U
            U'

            u
            u'

            R
            r'
    */


    function parseMove(notation) {

        if (!notation) {
            return null;
        }


        const raw =
            String(notation).trim();


        if (!raw) {
            return null;
        }


        const first =
            raw.charAt(0);


        const upper =
            first.toUpperCase();


        if (
            !["U", "L", "R", "B"]
                .includes(upper)
        ) {
            return null;
        }


        const isTip =
            first === first.toLowerCase();


        const inverse =
            raw.includes("'");


        return {

            base:
                upper,

            type:
                isTip
                    ? "tip"
                    : "layer",

            inverse,

            notation:
                (
                    isTip
                        ? upper.toLowerCase()
                        : upper
                ) +
                (
                    inverse
                        ? "'"
                        : ""
                )
        };
    }


    function inverseMove(notation) {

        const move =
            parseMove(notation);


        if (!move) {
            return null;
        }


        const baseNotation =
            move.type === "tip"
                ? move.base.toLowerCase()
                : move.base;


        return move.inverse
            ? baseNotation
            : baseNotation + "'";
    }


    // ============================================================
    // 36. ACTUALIZAR COORDENADAS DE PIEZAS
    // ============================================================

    function updatePieceCoordinates(piece) {

        updatePieceCenter(piece);


        piece.tetra =
            tetraCoordinates(
                piece.center
            );
    }


    function updateAllPieceCoordinates() {

        for (
            const piece
            of pieces
        ) {

            updatePieceCoordinates(
                piece
            );
        }
    }


    // ============================================================
    // 37. ASIGNAR CAPAS GRANDES
    // ============================================================

    /*
        Conservamos el sistema que funcionaba en V2.

        Esto es MUY importante:

        No estamos intentando reinventar ahora los movimientos
        U/L/R/B que ya funcionaban.

        Las puntas se manejan por separado.
    */


    const LAYER_THRESHOLD =
        0.315;


    function assignPieceLayers() {

        updateAllPieceCoordinates();


        for (
            const piece
            of pieces
        ) {

            piece.layers.clear();


            for (
                const moveName
                of ["U", "L", "R", "B"]
            ) {

                if (
                    piece.tetra[
                        moveName
                    ] >=
                    LAYER_THRESHOLD
                ) {

                    piece.layers.add(
                        moveName
                    );
                }
            }
        }
    }


    assignPieceLayers();


    // ============================================================
    // 38. OBTENER PIEZAS DE UNA CAPA
    // ============================================================

    function getPiecesForLayer(
        moveName
    ) {

        return pieces.filter(
            piece =>
                piece.layers.has(
                    moveName
                )
        );
    }


    // ============================================================
    // 39. OBTENER PIEZAS DE UNA PUNTA
    // ============================================================

    /*
        Normalmente debería existir UNA pieza agrupada para cada
        punta.

        Usamos filter en vez de find para que el motor siga
        funcionando incluso si una punta está representada por
        varias subpiezas geométricas.
    */


    function getPiecesForTip(
        tipName
    ) {

        return pieces.filter(
            piece =>
                piece.tip ===
                tipName
        );
    }


    // ============================================================
    // 40. DEBUG DE CAPAS Y PUNTAS
    // ============================================================

    function debugMovementGroups() {

        const result = {};


        for (
            const name
            of ["U", "L", "R", "B"]
        ) {

            const layerPieces =
                getPiecesForLayer(
                    name
                );


            const tipPieces =
                getPiecesForTip(
                    name
                );


            result[name] = {

                capa:
                    layerPieces.length,

                punta:
                    tipPieces.length,

                idsCapa:
                    layerPieces
                        .map(p => p.id)
                        .join(", "),

                idsPunta:
                    tipPieces
                        .map(p => p.id)
                        .join(", ")
            };
        }


        console.table(result);

        return result;
    }


    // ============================================================
    // 41. SNAPSHOT DE PIEZA
    // ============================================================

    function snapshotPiece(piece) {

        return {

            piece,

            bodyTriangles:
                piece.bodyTriangles.map(
                    triangle => ({

                        points:
                            cloneTriangle(
                                triangle.points
                            )
                    })
                ),

            stickers:
                piece.stickers.map(
                    sticker => ({

                        points:
                            cloneTriangle(
                                sticker.points
                            ),

                        normal:
                            cloneVec(
                                sticker.normal
                            )
                    })
                )
        };
    }


    // ============================================================
    // 42. ROTAR PIEZA DESDE SNAPSHOT
    // ============================================================

    function rotatePieceFromSnapshot(
        snapshot,
        axis,
        angle
    ) {

        const piece =
            snapshot.piece;


        // --------------------------------------------------------
        // PLÁSTICO
        // --------------------------------------------------------

        for (
            let i = 0;
            i <
            piece.bodyTriangles.length;
            i++
        ) {

            const current =
                piece.bodyTriangles[i];


            const original =
                snapshot.bodyTriangles[i];


            current.points =
                original.points.map(
                    point =>
                        rotateAroundAxis(
                            point,
                            axis,
                            angle
                        )
                );
        }


        // --------------------------------------------------------
        // STICKERS
        // --------------------------------------------------------

        for (
            let i = 0;
            i <
            piece.stickers.length;
            i++
        ) {

            const current =
                piece.stickers[i];


            const original =
                snapshot.stickers[i];


            current.points =
                original.points.map(
                    point =>
                        rotateAroundAxis(
                            point,
                            axis,
                            angle
                        )
                );


            current.normal =
                normalize(
                    rotateAroundAxis(
                        original.normal,
                        axis,
                        angle
                    )
                );
        }


        updatePieceCenter(
            piece
        );
    }


    // ============================================================
    // 43. SNAP FINAL
    // ============================================================

    function snapPieceGeometry(piece) {

        for (
            const triangle
            of piece.bodyTriangles
        ) {

            triangle.points =
                triangle.points.map(
                    snapVector
                );
        }


        for (
            const sticker
            of piece.stickers
        ) {

            sticker.points =
                sticker.points.map(
                    snapVector
                );


            sticker.normal =
                normalize(
                    snapVector(
                        sticker.normal
                    )
                );
        }


        updatePieceCenter(
            piece
        );
    }


    // ============================================================
    // 44. OBTENER PIEZAS AFECTADAS
    // ============================================================

    function getAffectedPieces(move) {

        if (
            move.type ===
            "tip"
        ) {

            return getPiecesForTip(
                move.base
            );
        }


        return getPiecesForLayer(
            move.base
        );
    }


    // ============================================================
    // 45. COMENZAR MOVIMIENTO
    // ============================================================

    function beginMove(
        notation,
        options = {}
    ) {

        if (currentMove) {
            return false;
        }


        const parsed =
            parseMove(
                notation
            );


        if (!parsed) {

            console.warn(
                "Movimiento inválido:",
                notation
            );

            return false;
        }


        /*
            Las capas grandes dependen de la posición actual.
        */

        if (
            parsed.type ===
            "layer"
        ) {

            assignPieceLayers();
        }


        const affectedPieces =
            getAffectedPieces(
                parsed
            );


        if (
            affectedPieces.length === 0
        ) {

            console.warn(
                "No se encontraron piezas para:",
                parsed.notation
            );


            setStatus(
                `No se encontró ${parsed.notation}`
            );


            return false;
        }


        const snapshots =
            affectedPieces.map(
                snapshotPiece
            );


        const axis =
            MOVE_AXES[
                parsed.base
            ];


        const direction =
            parsed.inverse
                ? -1
                : 1;


        currentMove = {

            base:
                parsed.base,

            type:
                parsed.type,

            notation:
                parsed.notation,

            inverse:
                parsed.inverse,

            direction,

            axis:
                cloneVec(axis),

            snapshots,

            start:
                performance.now(),

            duration:
                options.duration ??
                (
                    parsed.type ===
                    "tip"
                        ? TIP_MOVE_DURATION
                        : MOVE_DURATION
                ),

            record:
                options.record !== false,

            count:
                options.count !== false,

            source:
                options.source ??
                "manual"
        };


        if (
            parsed.type ===
            "tip"
        ) {

            setStatus(
                `Girando punta ${parsed.notation}`
            );

        } else {

            setStatus(
                `Girando capa ${parsed.notation}`
            );
        }


        return true;
    }


    // ============================================================
    // 46. ACTUALIZAR ANIMACIÓN
    // ============================================================

    function updateMoveAnimation(now) {

        if (!currentMove) {
            return;
        }


        const move =
            currentMove;


        const rawT =
            clamp(
                (
                    now -
                    move.start
                ) /
                move.duration,
                0,
                1
            );


        const easedT =
            easeInOutCubic(
                rawT
            );


        const angle =
            TURN_ANGLE *
            move.direction *
            easedT;


        /*
            Cada frame parte SIEMPRE de la geometría inicial.

            Así no acumulamos errores.
        */

        for (
            const snapshot
            of move.snapshots
        ) {

            rotatePieceFromSnapshot(
                snapshot,
                move.axis,
                angle
            );
        }


        uploadGeometry();


        if (
            rawT >= 1
        ) {

            finishMove();
        }
    }


    // ============================================================
    // 47. FINALIZAR MOVIMIENTO
    // ============================================================

    function finishMove() {

        if (!currentMove) {
            return;
        }


        const move =
            currentMove;


        const finalAngle =
            TURN_ANGLE *
            move.direction;


        for (
            const snapshot
            of move.snapshots
        ) {

            rotatePieceFromSnapshot(
                snapshot,
                move.axis,
                finalAngle
            );


            snapPieceGeometry(
                snapshot.piece
            );
        }


        /*
            IMPORTANTE:

            piece.tip representa la identidad física de esa punta.

            Si giramos u, sigue siendo la misma punta U.

            Si giramos una capa grande, la punta correspondiente
            viaja con esa capa, pero su identidad sigue existiendo.

            Por eso NO volvemos a ejecutar identifyTips() aquí.
        */


        assignPieceLayers();


        if (move.record) {

            moveHistory.push(
                move.notation
            );
        }


        if (move.count) {

            moveCounter++;

            updateCounter();
        }


        const finished =
            move.notation;


        currentMove =
            null;


        uploadGeometry();


        if (
            moveQueue.length === 0
        ) {

            setStatus(
                `${finished} completado`
            );
        }
    }


    // ============================================================
    // 48. COLA DE MOVIMIENTOS
    // ============================================================

    function queueMove(
        notation,
        options = {}
    ) {

        const parsed =
            parseMove(
                notation
            );


        if (!parsed) {
            return false;
        }


        moveQueue.push({

            notation:
                parsed.notation,

            options
        });


        return true;
    }


    function processMoveQueue() {

        if (
            stopped ||
            currentMove ||
            moveQueue.length === 0
        ) {
            return;
        }


        const next =
            moveQueue.shift();


        beginMove(
            next.notation,
            next.options
        );
    }


    // ============================================================
    // 49. MOVIMIENTO MANUAL
    // ============================================================

    function performMove(
        notation
    ) {

        /*
            Para movimientos manuales todavía esperamos que termine
            la animación actual.

            OJO:
            Esto NO bloqueará la cámara.

            La Parte 3 hará que la cámara tenga un estado de pointer
            completamente independiente.
        */

        if (
            stopped ||
            currentMove ||
            moveQueue.length
        ) {
            return false;
        }


        return beginMove(
            notation,
            {
                record:
                    true,

                count:
                    true,

                source:
                    "manual"
            }
        );
    }


    // ============================================================
    // 50. MOVIMIENTOS DISPONIBLES
    // ============================================================

    const LAYER_MOVES = [

        "U",
        "U'",

        "L",
        "L'",

        "R",
        "R'",

        "B",
        "B'"
    ];


    const TIP_MOVES = [

        "u",
        "u'",

        "l",
        "l'",

        "r",
        "r'",

        "b",
        "b'"
    ];


    // ============================================================
    // 51. GENERAR SCRAMBLE
    // ============================================================

    function randomFrom(array) {

        return array[
            Math.floor(
                Math.random() *
                array.length
            )
        ];
    }


    function scramblePuzzle() {

        if (
            currentMove ||
            moveQueue.length
        ) {
            return;
        }


        stopped =
            false;


        const scramble =
            [];


        let previousBase =
            null;


        // --------------------------------------------------------
        // CAPAS PRINCIPALES
        // --------------------------------------------------------

        for (
            let i = 0;
            i < 11;
            i++
        ) {

            let notation;
            let parsed;


            do {

                notation =
                    randomFrom(
                        LAYER_MOVES
                    );


                parsed =
                    parseMove(
                        notation
                    );

            } while (
                parsed.base ===
                previousBase
            );


            previousBase =
                parsed.base;


            scramble.push(
                notation
            );
        }


        // --------------------------------------------------------
        // PUNTAS
        // --------------------------------------------------------

        /*
            En un scramble real del Pyraminx las puntas también
            pueden quedar giradas.

            Elegimos aleatoriamente si cada punta se mueve.
        */

        for (
            const tip
            of ["u", "l", "r", "b"]
        ) {

            const random =
                Math.random();


            if (
                random < 0.34
            ) {

                /*
                    No mover esta punta.
                */

                continue;
            }


            if (
                random < 0.67
            ) {

                scramble.push(
                    tip
                );

            } else {

                scramble.push(
                    tip + "'"
                );
            }
        }


        // --------------------------------------------------------
        // ENCOLAR
        // --------------------------------------------------------

        for (
            const notation
            of scramble
        ) {

            const parsed =
                parseMove(
                    notation
                );


            queueMove(
                notation,
                {
                    duration:
                        parsed.type ===
                        "tip"
                            ? 145
                            : 180,

                    record:
                        true,

                    count:
                        true,

                    source:
                        "scramble"
                }
            );
        }


        setStatus(
            "Mezclando Pyraminx..."
        );


        console.log(
            "🔀 Scramble:",
            scramble.join(" ")
        );
    }


    // ============================================================
    // 52. RESOLVER USANDO HISTORIAL
    // ============================================================

    function solvePuzzle() {

        if (
            currentMove ||
            moveQueue.length
        ) {
            return;
        }


        if (
            moveHistory.length === 0
        ) {

            setStatus(
                "El Pyraminx ya está resuelto"
            );

            return;
        }


        stopped =
            false;


        const solution =
            [...moveHistory]
                .reverse()
                .map(
                    inverseMove
                )
                .filter(Boolean);


        /*
            Limpiamos antes de resolver porque los movimientos de
            solución tienen record:false.
        */

        moveHistory = [];


        for (
            const notation
            of solution
        ) {

            const parsed =
                parseMove(
                    notation
                );


            queueMove(
                notation,
                {
                    duration:
                        parsed.type ===
                        "tip"
                            ? 145
                            : 185,

                    record:
                        false,

                    count:
                        true,

                    source:
                        "solve"
                }
            );
        }


        setStatus(
            "Resolviendo Pyraminx..."
        );


        console.log(
            "✨ Solución:",
            solution.join(" ")
        );
    }


    // ============================================================
    // 53. RESET
    // ============================================================

    function resetPuzzleGeometry() {

        stopped =
            true;


        currentMove =
            null;


        moveQueue =
            [];


        moveHistory =
            [];


        moveCounter =
            0;


        updateCounter();


        /*
            Reconstruimos el puzzle ORIGINAL.

            Esto también vuelve a identificar las puntas.
        */

        buildPuzzle();


        assignPieceLayers();


        uploadGeometry();


        stopped =
            false;


        setStatus(
            "Pyraminx reiniciado"
        );
    }


    // ============================================================
    // 54. DETENER
    // ============================================================

    function stopPuzzle() {

        /*
            Quitamos movimientos pendientes.
        */

        moveQueue =
            [];


        /*
            Si una pieza está a mitad de movimiento, terminamos
            exactamente los 120°.

            Así jamás dejamos el Pyraminx deformado.
        */

        if (currentMove) {

            finishMove();
        }


        stopped =
            false;


        setStatus(
            "Animación detenida"
        );
    }


    // ============================================================
    // 55. BOTONES HTML DE MOVIMIENTO
    // ============================================================

    moveButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const notation =
                        button.dataset.move;


                    if (!notation) {
                        return;
                    }


                    performMove(
                        notation
                    );
                }
            );
        }
    );


    // ============================================================
    // 56. BOTONES PRINCIPALES
    // ============================================================

    if (btnScramble) {

        btnScramble.addEventListener(
            "click",
            scramblePuzzle
        );
    }


    if (btnSolve) {

        btnSolve.addEventListener(
            "click",
            solvePuzzle
        );
    }


    if (btnReset) {

        btnReset.addEventListener(
            "click",
            resetPuzzleGeometry
        );
    }


    if (btnStop) {

        btnStop.addEventListener(
            "click",
            stopPuzzle
        );
    }


    // ============================================================
    // 57. TECLADO
    // ============================================================

    /*
        Controles:

            U L R B
                capa completa

            Shift + U/L/R/B
                capa inversa

        Para las puntas:

            Alt + U
            Alt + L
            Alt + R
            Alt + B

                punta

            Alt + Shift + U/L/R/B
                punta inversa
    */


    window.addEventListener(
        "keydown",
        event => {

            const target =
                event.target;


            if (
                target &&
                (
                    target.tagName ===
                    "INPUT" ||

                    target.tagName ===
                    "TEXTAREA" ||

                    target.tagName ===
                    "SELECT"
                )
            ) {
                return;
            }


            const base =
                event.key.toUpperCase();


            if (
                ![
                    "U",
                    "L",
                    "R",
                    "B"
                ].includes(base)
            ) {
                return;
            }


            let notation;


            if (
                event.altKey
            ) {

                notation =
                    base.toLowerCase();

            } else {

                notation =
                    base;
            }


            if (
                event.shiftKey
            ) {

                notation +=
                    "'";
            }


            event.preventDefault();


            performMove(
                notation
            );
        }
    );


    // ============================================================
    // 58. API DEBUG V2.1
    // ============================================================

    Object.assign(
        window.easyRubikPyraminxV21,
        {

            move:
                performMove,


            scramble:
                scramblePuzzle,


            solve:
                solvePuzzle,


            reset:
                resetPuzzleGeometry,


            groups:
                debugMovementGroups,


            history() {

                return [
                    ...moveHistory
                ];
            },


            queue() {

                return moveQueue.map(
                    item =>
                        item.notation
                );
            },


            state() {

                return {

                    currentMove:
                        currentMove
                            ? {
                                notation:
                                    currentMove.notation,

                                type:
                                    currentMove.type,

                                base:
                                    currentMove.base
                            }
                            : null,


                    counter:
                        moveCounter,


                    history:
                        [
                            ...moveHistory
                        ],


                    queue:
                        moveQueue.map(
                            item =>
                                item.notation
                        ),


                    layers: {

                        U:
                            getPiecesForLayer("U")
                                .map(p => p.id),

                        L:
                            getPiecesForLayer("L")
                                .map(p => p.id),

                        R:
                            getPiecesForLayer("R")
                                .map(p => p.id),

                        B:
                            getPiecesForLayer("B")
                                .map(p => p.id)
                    },


                    tips: {

                        U:
                            getPiecesForTip("U")
                                .map(p => p.id),

                        L:
                            getPiecesForTip("L")
                                .map(p => p.id),

                        R:
                            getPiecesForTip("R")
                                .map(p => p.id),

                        B:
                            getPiecesForTip("B")
                                .map(p => p.id)
                    }
                };
            }
        }
    );


    // ============================================================
    // 59. COMPROBACIÓN
    // ============================================================

    console.log(
        "========================================"
    );


    console.log(
        "🔺 Pyraminx V2.1 — Parte 2 cargada"
    );


    console.log(
        "Grupos de movimiento:"
    );


    debugMovementGroups();


    console.log(
        "Controles:"
    );


    console.log(
        "U L R B = capas"
    );


    console.log(
        "Alt + U/L/R/B = puntas"
    );


    console.log(
        "Shift = sentido inverso"
    );


    console.log(
        "========================================"
    );


    // ============================================================
    // TODAVÍA NO CERRAR
    //
    // NO pongas:
    //
    // })();
    //
    // PARTE 3/3 VA INMEDIATAMENTE DEBAJO.
    // ============================================================

        // ============================================================
    // easyRubik — PYRAMINX V2.1
    // PARTE 3/3
    //
    // Picking + mouse + puntas + cámara libre + render final
    // ============================================================


    // ============================================================
    // 60. TRANSFORMAR VEC4
    // ============================================================

    function transformVec4(matrix, vector) {

        return [
            matrix[0] * vector[0] +
            matrix[4] * vector[1] +
            matrix[8] * vector[2] +
            matrix[12] * vector[3],

            matrix[1] * vector[0] +
            matrix[5] * vector[1] +
            matrix[9] * vector[2] +
            matrix[13] * vector[3],

            matrix[2] * vector[0] +
            matrix[6] * vector[1] +
            matrix[10] * vector[2] +
            matrix[14] * vector[3],

            matrix[3] * vector[0] +
            matrix[7] * vector[1] +
            matrix[11] * vector[2] +
            matrix[15] * vector[3]
        ];
    }


    // ============================================================
    // 61. PROYECTAR 3D -> PANTALLA
    // ============================================================

    function projectPoint(point) {

        const matrix =
            getViewProjectionMatrix();


        const clip =
            transformVec4(
                matrix,
                [
                    point[0],
                    point[1],
                    point[2],
                    1
                ]
            );


        if (
            Math.abs(clip[3]) <
            0.000001
        ) {
            return null;
        }


        const ndcX =
            clip[0] / clip[3];

        const ndcY =
            clip[1] / clip[3];

        const ndcZ =
            clip[2] / clip[3];


        const rect =
            canvas.getBoundingClientRect();


        return {

            x:
                rect.left +
                (
                    ndcX * 0.5 +
                    0.5
                ) *
                rect.width,

            y:
                rect.top +
                (
                    1 -
                    (
                        ndcY * 0.5 +
                        0.5
                    )
                ) *
                rect.height,

            z:
                ndcZ
        };
    }


    // ============================================================
    // 62. TRIÁNGULO 2D
    // ============================================================

    function sign2D(
        px,
        py,
        ax,
        ay,
        bx,
        by
    ) {

        return (
            (px - bx) *
            (ay - by)
            -
            (ax - bx) *
            (py - by)
        );
    }


    function pointInsideTriangle(
        x,
        y,
        a,
        b,
        c
    ) {

        const d1 =
            sign2D(
                x, y,
                a.x, a.y,
                b.x, b.y
            );


        const d2 =
            sign2D(
                x, y,
                b.x, b.y,
                c.x, c.y
            );


        const d3 =
            sign2D(
                x, y,
                c.x, c.y,
                a.x, a.y
            );


        const hasNegative =
            (
                d1 < 0 ||
                d2 < 0 ||
                d3 < 0
            );


        const hasPositive =
            (
                d1 > 0 ||
                d2 > 0 ||
                d3 > 0
            );


        return !(
            hasNegative &&
            hasPositive
        );
    }


    // ============================================================
    // 63. PICKING
    // ============================================================

    function pickSticker(
        clientX,
        clientY
    ) {

        let bestHit =
            null;


        for (
            const piece
            of pieces
        ) {

            for (
                const sticker
                of piece.stickers
            ) {

                const a =
                    projectPoint(
                        sticker.points[0]
                    );


                const b =
                    projectPoint(
                        sticker.points[1]
                    );


                const c =
                    projectPoint(
                        sticker.points[2]
                    );


                if (
                    !a ||
                    !b ||
                    !c
                ) {
                    continue;
                }


                if (
                    !pointInsideTriangle(
                        clientX,
                        clientY,
                        a,
                        b,
                        c
                    )
                ) {
                    continue;
                }


                const depth =
                    (
                        a.z +
                        b.z +
                        c.z
                    ) / 3;


                if (
                    !bestHit ||
                    depth <
                    bestHit.depth
                ) {

                    bestHit = {

                        piece,

                        sticker,

                        depth,

                        isTip:
                            piece.tip !==
                            null,

                        tip:
                            piece.tip
                    };
                }
            }
        }


        return bestHit;
    }


    // ============================================================
    // 64. MATEMÁTICA 2D
    // ============================================================

    function normalize2D(v) {

        const length =
            Math.sqrt(
                v.x * v.x +
                v.y * v.y
            );


        if (
            length <
            0.00001
        ) {

            return {
                x: 0,
                y: 0
            };
        }


        return {

            x:
                v.x / length,

            y:
                v.y / length
        };
    }


    function dot2D(a, b) {

        return (
            a.x * b.x +
            a.y * b.y
        );
    }


    // ============================================================
    // 65. DIRECCIÓN DEL EJE EN PANTALLA
    // ============================================================

    function projectedAxisDirection(
        moveName
    ) {

        const origin =
            projectPoint(
                [0, 0, 0]
            );


        const axisPoint =
            projectPoint(
                scale(
                    MOVE_AXES[
                        moveName
                    ],
                    1.25
                )
            );


        if (
            !origin ||
            !axisPoint
        ) {
            return null;
        }


        return normalize2D({

            x:
                axisPoint.x -
                origin.x,

            y:
                axisPoint.y -
                origin.y
        });
    }


    // ============================================================
    // 66. DIRECCIÓN TANGENCIAL
    // ============================================================

    function projectedTurnDirection(
        moveName
    ) {

        const axis =
            projectedAxisDirection(
                moveName
            );


        if (!axis) {
            return null;
        }


        return normalize2D({

            x:
                -axis.y,

            y:
                axis.x
        });
    }


    // ============================================================
    // 67. CAPAS POSIBLES DE UNA PIEZA
    // ============================================================

    function candidateLayersForPiece(
        piece
    ) {

        assignPieceLayers();


        const candidates =
            [];


        for (
            const name
            of ["U", "L", "R", "B"]
        ) {

            if (
                piece.layers.has(
                    name
                )
            ) {

                candidates.push(
                    name
                );
            }
        }


        return candidates;
    }


    // ============================================================
    // 68. ELEGIR CAPA SEGÚN DRAG
    // ============================================================

    function chooseLayerMoveFromDrag(
        piece,
        dx,
        dy
    ) {

        const candidates =
            candidateLayersForPiece(
                piece
            );


        if (
            candidates.length === 0
        ) {
            return null;
        }


        const drag =
            normalize2D({

                x: dx,
                y: dy
            });


        let bestMove =
            null;

        let bestScore =
            -Infinity;

        let bestSignedScore =
            0;


        for (
            const moveName
            of candidates
        ) {

            const tangent =
                projectedTurnDirection(
                    moveName
                );


            if (!tangent) {
                continue;
            }


            const signedScore =
                dot2D(
                    drag,
                    tangent
                );


            const score =
                Math.abs(
                    signedScore
                );


            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;

                bestSignedScore =
                    signedScore;

                bestMove =
                    moveName;
            }
        }


        if (
            !bestMove ||
            bestScore < 0.28
        ) {

            return null;
        }


        return (
            bestMove +
            (
                bestSignedScore < 0
                    ? "'"
                    : ""
            )
        );
    }


    // ============================================================
    // 69. ELEGIR MOVIMIENTO DE PUNTA
    // ============================================================

    function chooseTipMoveFromDrag(
        piece,
        dx,
        dy
    ) {

        if (!piece.tip) {
            return null;
        }


        const tangent =
            projectedTurnDirection(
                piece.tip
            );


        if (!tangent) {
            return null;
        }


        const drag =
            normalize2D({

                x: dx,
                y: dy
            });


        const signedScore =
            dot2D(
                drag,
                tangent
            );


        /*
            Si el gesto no tiene suficiente intención,
            no hacemos nada.
        */

        if (
            Math.abs(
                signedScore
            ) < 0.22
        ) {

            return null;
        }


        const base =
            piece.tip.toLowerCase();


        return (
            base +
            (
                signedScore < 0
                    ? "'"
                    : ""
            )
        );
    }


    // ============================================================
    // 70. ESTADO DEL POINTER
    // ============================================================

    let pointerActive =
        false;


    let pointerId =
        null;


    let pointerMode =
        null;


    let pointerStartX =
        0;


    let pointerStartY =
        0;


    let pointerLastX =
        0;


    let pointerLastY =
        0;


    let pointerHit =
        null;


    const PUZZLE_DRAG_THRESHOLD =
        24;


    // ============================================================
    // 71. POINTER DOWN
    // ============================================================

    canvas.addEventListener(
        "pointerdown",
        event => {

            pointerActive =
                true;


            pointerId =
                event.pointerId;


            pointerStartX =
                event.clientX;


            pointerStartY =
                event.clientY;


            pointerLastX =
                event.clientX;


            pointerLastY =
                event.clientY;


            pointerHit =
                null;


            /*
                ==================================================
                CÁMARA FORZADA
                ==================================================

                Botón derecho
                    o
                Shift + botón izquierdo

                SIEMPRE mueve la cámara.

                Incluso si:
                    - está mezclando
                    - está resolviendo
                    - currentMove existe
                    - hay movimientos en cola
            */


            if (
                event.button === 2 ||
                event.shiftKey
            ) {

                pointerMode =
                    "camera";
            }

            else {

                /*
                    Si existe una animación, no queremos iniciar
                    OTRO movimiento del puzzle.

                    PERO sí queremos poder mover la cámara.

                    Por eso durante una animación el drag normal
                    también se convierte en cámara.
                */

                if (
                    currentMove ||
                    moveQueue.length > 0
                ) {

                    pointerMode =
                        "camera";
                }

                else {

                    pointerHit =
                        pickSticker(
                            event.clientX,
                            event.clientY
                        );


                    if (pointerHit) {

                        pointerMode =
                            "puzzle";
                    }

                    else {

                        pointerMode =
                            "camera";
                    }
                }
            }


            canvas.style.cursor =
                "grabbing";


            try {

                canvas.setPointerCapture(
                    event.pointerId
                );

            } catch (_) {}


            event.preventDefault();
        }
    );


    // ============================================================
    // 72. MOVER CÁMARA
    // ============================================================

    function handleCameraDrag(
        dx,
        dy
    ) {

        /*
            Movimiento tipo "agarrar el objeto".

            Mouse a la derecha
                → Pyraminx visualmente acompaña a la derecha.

            Mouse hacia arriba
                → Pyraminx acompaña hacia arriba.

            Aquí invertimos el signo horizontal respecto a una
            cámara orbital tradicional para que el objeto se
            sienta agarrado directamente.
        */


        targetYaw +=
            dx * 0.0065;


        targetPitch +=
            dy * 0.0065;


        targetPitch =
            clamp(
                targetPitch,
                -1.38,
                1.38
            );
    }


    // ============================================================
    // 73. POINTER MOVE
    // ============================================================

    canvas.addEventListener(
        "pointermove",
        event => {

            // ----------------------------------------------------
            // HOVER
            // ----------------------------------------------------

            if (!pointerActive) {

                /*
                    No hacemos picking constantemente mientras
                    el puzzle está animándose.

                    Esto reduce trabajo innecesario.
                */

                if (
                    !currentMove &&
                    moveQueue.length === 0
                ) {

                    const hit =
                        pickSticker(
                            event.clientX,
                            event.clientY
                        );


                    if (
                        hit &&
                        hit.isTip
                    ) {

                        canvas.style.cursor =
                            "pointer";
                    }

                    else if (hit) {

                        canvas.style.cursor =
                            "grab";
                    }

                    else {

                        canvas.style.cursor =
                            "grab";
                    }
                }

                else {

                    canvas.style.cursor =
                        "grab";
                }


                return;
            }


            if (
                event.pointerId !==
                pointerId
            ) {
                return;
            }


            const frameDX =
                event.clientX -
                pointerLastX;


            const frameDY =
                event.clientY -
                pointerLastY;


            // ====================================================
            // CÁMARA
            // ====================================================

            if (
                pointerMode ===
                "camera"
            ) {

                handleCameraDrag(
                    frameDX,
                    frameDY
                );


                pointerLastX =
                    event.clientX;


                pointerLastY =
                    event.clientY;


                event.preventDefault();

                return;
            }


            // ====================================================
            // PUZZLE
            // ====================================================

            if (
                pointerMode ===
                "puzzle" &&
                pointerHit
            ) {

                const totalDX =
                    event.clientX -
                    pointerStartX;


                const totalDY =
                    event.clientY -
                    pointerStartY;


                const distance =
                    Math.sqrt(
                        totalDX * totalDX +
                        totalDY * totalDY
                    );


                if (
                    distance >=
                    PUZZLE_DRAG_THRESHOLD
                ) {

                    let notation =
                        null;


                    /*
                        Si agarramos una pieza identificada como
                        punta:

                            u / l / r / b

                        Si no:

                            U / L / R / B
                    */


                    if (
                        pointerHit.isTip &&
                        pointerHit.piece.tip
                    ) {

                        notation =
                            chooseTipMoveFromDrag(
                                pointerHit.piece,
                                totalDX,
                                totalDY
                            );
                    }

                    else {

                        notation =
                            chooseLayerMoveFromDrag(
                                pointerHit.piece,
                                totalDX,
                                totalDY
                            );
                    }


                    if (notation) {

                        pointerActive =
                            false;


                        pointerMode =
                            null;


                        pointerId =
                            null;


                        pointerHit =
                            null;


                        canvas.style.cursor =
                            "grab";


                        performMove(
                            notation
                        );


                        event.preventDefault();

                        return;
                    }
                }
            }


            pointerLastX =
                event.clientX;


            pointerLastY =
                event.clientY;
        }
    );


    // ============================================================
    // 74. LIBERAR POINTER
    // ============================================================

    function releasePointer(
        event
    ) {

        if (
            event &&
            pointerId !== null &&
            event.pointerId !==
            pointerId
        ) {

            return;
        }


        pointerActive =
            false;


        pointerId =
            null;


        pointerMode =
            null;


        pointerHit =
            null;


        canvas.style.cursor =
            "grab";
    }


    canvas.addEventListener(
        "pointerup",
        releasePointer
    );


    canvas.addEventListener(
        "pointercancel",
        releasePointer
    );


    // ============================================================
    // 75. EVITAR MENÚ DERECHO
    // ============================================================

    canvas.addEventListener(
        "contextmenu",
        event => {

            event.preventDefault();
        }
    );


    // ============================================================
    // 76. ZOOM SIEMPRE DISPONIBLE
    // ============================================================

    canvas.addEventListener(
        "wheel",
        event => {

            event.preventDefault();


            const delta =
                clamp(
                    event.deltaY,
                    -120,
                    120
                );


            targetDistance +=
                delta *
                0.006;


            targetDistance =
                clamp(
                    targetDistance,
                    3.7,
                    8.2
                );

        },
        {
            passive: false
        }
    );


    // ============================================================
    // 77. RESET DE CÁMARA
    // ============================================================

    function resetCamera() {

        targetYaw =
            0.52;


        targetPitch =
            -0.15;


        targetDistance =
            5.6;
    }


    // ============================================================
    // 78. DOBLE CLIC
    // ============================================================

    canvas.addEventListener(
        "dblclick",
        event => {

            event.preventDefault();

            resetCamera();
        }
    );


    // ============================================================
    // 79. RESET TAMBIÉN CENTRA CÁMARA
    // ============================================================

    if (btnReset) {

        btnReset.addEventListener(
            "click",
            resetCamera
        );
    }


    // ============================================================
    // 80. SUAVIZADO DE CÁMARA
    // ============================================================

    function updateCamera() {

        /*
            La cámara NO depende de currentMove.

            Por eso esto sigue ejecutándose mientras:

                U gira
                R gira
                scramble corre
                solve corre
                una punta gira
        */


        cameraYaw +=
            (
                targetYaw -
                cameraYaw
            ) *
            0.19;


        cameraPitch +=
            (
                targetPitch -
                cameraPitch
            ) *
            0.19;


        cameraDistance +=
            (
                targetDistance -
                cameraDistance
            ) *
            0.16;
    }


    // ============================================================
    // 81. ESTADO FINAL DE SCRAMBLE / SOLVE
    // ============================================================

    let previousQueueLength =
        0;


    function updateActivityStatus() {

        /*
            Solo detectamos cuándo una cola termina.

            No interferimos con los mensajes durante cada giro.
        */


        const currentQueueLength =
            moveQueue.length;


        if (
            previousQueueLength > 0 &&
            currentQueueLength === 0 &&
            !currentMove
        ) {

            setStatus(
                "Pyraminx listo"
            );
        }


        previousQueueLength =
            currentQueueLength;
    }


    // ============================================================
    // 82. RENDER LOOP
    // ============================================================

    function render(time) {

        /*
            ======================================================
            ORDEN IMPORTANTE
            ======================================================

            Cámara y puzzle se actualizan por separado.

            De esta manera podemos mover la cámara aunque exista
            una animación.
        */


        // 1. Cámara
        updateCamera();


        // 2. Movimiento actual
        updateMoveAnimation(
            time
        );


        // 3. Cola
        processMoveQueue();


        // 4. Estado
        updateActivityStatus();


        // 5. Render
        drawScene();


        // 6. Próximo frame
        requestAnimationFrame(
            render
        );
    }


    // ============================================================
    // 83. API DEBUG FINAL
    // ============================================================

    Object.assign(
        window.easyRubikPyraminxV21,
        {

            cameraReset:
                resetCamera,


            camera() {

                return {

                    yaw:
                        cameraYaw,

                    pitch:
                        cameraPitch,

                    distance:
                        cameraDistance,

                    targetYaw,

                    targetPitch,

                    targetDistance
                };
            },


            pick(x, y) {

                return pickSticker(
                    x,
                    y
                );
            },


            tipMove(
                name,
                inverse = false
            ) {

                const base =
                    String(name)
                        .charAt(0)
                        .toLowerCase();


                if (
                    ![
                        "u",
                        "l",
                        "r",
                        "b"
                    ].includes(base)
                ) {

                    console.warn(
                        "Punta inválida:",
                        name
                    );

                    return false;
                }


                return performMove(
                    base +
                    (
                        inverse
                            ? "'"
                            : ""
                    )
                );
            },


            layerMove(
                name,
                inverse = false
            ) {

                const base =
                    String(name)
                        .charAt(0)
                        .toUpperCase();


                if (
                    ![
                        "U",
                        "L",
                        "R",
                        "B"
                    ].includes(base)
                ) {

                    console.warn(
                        "Capa inválida:",
                        name
                    );

                    return false;
                }


                return performMove(
                    base +
                    (
                        inverse
                            ? "'"
                            : ""
                    )
                );
            }
        }
    );


    // ============================================================
    // 84. INICIALIZACIÓN FINAL
    // ============================================================

    assignPieceLayers();


    uploadGeometry();


    resetCamera();


    updateCounter();


    canvas.style.cursor =
        "grab";


    setStatus(
        "Pyraminx listo"
    );


    console.log(
        "========================================"
    );


    console.log(
        "🔺 easyRubik — Pyraminx V2.1 COMPLETO"
    );


    console.log(
        "Piezas:",
        pieces.length
    );


    console.log(
        "Puntas detectadas:"
    );


    debugTips();


    console.log(
        "Grupos:"
    );


    debugMovementGroups();


    console.log(
        "CONTROLES:"
    );


    console.log(
        "Arrastrar pieza = mover Pyraminx"
    );


    console.log(
        "Arrastrar punta = mover solamente punta"
    );


    console.log(
        "Arrastrar fondo = cámara"
    );


    console.log(
        "Shift + arrastrar = cámara SIEMPRE"
    );


    console.log(
        "Botón derecho + arrastrar = cámara SIEMPRE"
    );


    console.log(
        "Rueda = zoom SIEMPRE"
    );


    console.log(
        "Doble clic = centrar cámara"
    );


    console.log(
        "U/L/R/B = capas"
    );


    console.log(
        "Alt + U/L/R/B = puntas"
    );


    console.log(
        "========================================"
    );


    // ============================================================
    // 85. ARRANCAR
    // ============================================================

    requestAnimationFrame(
        render
    );


    // ============================================================
    // FIN — easyRubik Pyraminx V2.1
    // ============================================================

})();