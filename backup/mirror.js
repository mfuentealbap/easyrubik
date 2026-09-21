(() => {
"use strict";

/* ============================================================
   easyRubik — MIRROR CUBE 3×3
   Motor 3D
   PARTE 1/4

   - WebGL puro
   - Mirror plateado
   - Piezas sólidas
   - Cámara 3D
   - Sin librerías externas
   ============================================================ */


/* ============================================================
   CANVAS + WEBGL
   ============================================================ */

const canvas = document.getElementById("stage");

if (!canvas) {
    console.error("❌ easyRubik Mirror: no existe #stage");
    return;
}

const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: false,
    depth: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false
});

if (!gl) {
    console.error("❌ WebGL no está disponible.");
    return;
}


/* ============================================================
   ELEMENTOS DEL HTML
   ============================================================ */

const statusEl =
    document.getElementById("status");

const counterEl =
    document.getElementById("moveCounter");

const btnScramble =
    document.getElementById("btnScramble");

const btnSolve =
    document.getElementById("btnSolve");

const btnReset =
    document.getElementById("btnReset");

const btnCamera =
    document.getElementById("btnCamera");

const moveButtons =
    document.querySelectorAll("[data-move]");


function setStatus(text) {

    if (statusEl) {
        statusEl.textContent = text;
    }
}


/* ============================================================
   CONSTANTES
   ============================================================ */

const PI = Math.PI;
const HALF_PI = PI / 2;

const MOVE_DURATION = 280;
const SCRAMBLE_DURATION = 145;
const SOLVE_DURATION = 175;


/*
   ============================================================
   FORMA DEL MIRROR
   ============================================================

   El puzzle resuelto sigue midiendo exactamente 3 × 3 × 3.

   Pero los cortes NO están en:

       -1.5  -0.5   0.5   1.5

   porque eso produciría un Rubik normal.

   Los desplazamos de manera moderada para obtener el aspecto
   característico del Mirror sin hacer piezas absurdamente
   grandes o pequeñas.
*/

const CUT_X = [
    -1.500,
    -0.590,
     0.455,
     1.500
];

const CUT_Y = [
    -1.500,
    -0.435,
     0.525,
     1.500
];

const CUT_Z = [
    -1.500,
    -0.520,
     0.395,
     1.500
];


/*
   Junta entre piezas.

   Es deliberadamente MUY pequeña.
*/

const SEAM = 0.018;


/*
   Bisel de las piezas.

   Hace una diferencia enorme visualmente:
   deja de parecer un conjunto de cajas básicas.
*/

const BEVEL = 0.020;

/*
   Retícula física segura.

   Un Mirror real tiene un mecanismo 3×3 regular debajo de la
   modificación de forma. Las piezas nunca deben usar sus cortes
   asimétricos como centros de giro, porque eso hace que se atraviesen.
*/
const SAFE_PITCH = 1.04;

function logicalToCenter(logical) {
    return [
        logical[0] * SAFE_PITCH,
        logical[1] * SAFE_PITCH,
        logical[2] * SAFE_PITCH
    ];
}

function collisionSafeDimension(raw) {
    return clamp(
        0.96 + (raw - 1.0) * 0.72,
        0.86,
        1.00
    );
}


/* ============================================================
   UTILIDADES
   ============================================================ */

function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


function lerp(a, b, t) {

    return a + (b - a) * t;
}


function easeInOutCubic(t) {

    if (t < 0.5) {

        return (
            4 *
            t *
            t *
            t
        );
    }

    return (
        1 -
        Math.pow(
            -2 * t + 2,
            3
        ) / 2
    );
}


function copy3(v) {

    return [
        v[0],
        v[1],
        v[2]
    ];
}


function add3(a, b) {

    return [
        a[0] + b[0],
        a[1] + b[1],
        a[2] + b[2]
    ];
}


function subtract3(a, b) {

    return [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2]
    ];
}


function scale3(v, s) {

    return [
        v[0] * s,
        v[1] * s,
        v[2] * s
    ];
}


function dot3(a, b) {

    return (
        a[0] * b[0] +
        a[1] * b[1] +
        a[2] * b[2]
    );
}


function cross3(a, b) {

    return [

        a[1] * b[2] -
        a[2] * b[1],

        a[2] * b[0] -
        a[0] * b[2],

        a[0] * b[1] -
        a[1] * b[0]
    ];
}


function length3(v) {

    return Math.hypot(
        v[0],
        v[1],
        v[2]
    );
}


function normalize3(v) {

    const len =
        length3(v) || 1;

    return [
        v[0] / len,
        v[1] / len,
        v[2] / len
    ];
}


/* ============================================================
   ROTACIÓN DE VECTOR
   ============================================================ */

/*
   Fórmula de Rodrigues.

   Esto permite rotar tanto:

       - posiciones
       - ejes locales
       - normales

   alrededor de cualquier eje.
*/

function rotateVector(
    vector,
    axis,
    angle
) {

    const n =
        normalize3(axis);

    const c =
        Math.cos(angle);

    const s =
        Math.sin(angle);

    const d =
        dot3(
            n,
            vector
        );

    const cross =
        cross3(
            n,
            vector
        );

    return [

        vector[0] * c +
        cross[0] * s +
        n[0] * d * (1 - c),

        vector[1] * c +
        cross[1] * s +
        n[1] * d * (1 - c),

        vector[2] * c +
        cross[2] * s +
        n[2] * d * (1 - c)
    ];
}


/* ============================================================
   SNAP NUMÉRICO
   ============================================================ */

/*
   Después de varios movimientos:

       cos(90°)

   puede terminar siendo algo como:

       0.000000000000061

   Esto lo limpia.
*/

function snapNumber(value) {

    if (
        Math.abs(value) <
        0.000001
    ) {
        return 0;
    }

    if (
        Math.abs(value - 1) <
        0.000001
    ) {
        return 1;
    }

    if (
        Math.abs(value + 1) <
        0.000001
    ) {
        return -1;
    }

    return (
        Math.round(
            value * 1000000
        ) /
        1000000
    );
}


function snapVector(v) {

    return [
        snapNumber(v[0]),
        snapNumber(v[1]),
        snapNumber(v[2])
    ];
}


/* ============================================================
   MATRICES 4 × 4
   ============================================================ */

function mat4Identity() {

    return new Float32Array([
        1, 0, 0, 0,

        0, 1, 0, 0,

        0, 0, 1, 0,

        0, 0, 0, 1
    ]);
}


function mat4Multiply(a, b) {

    const out =
        new Float32Array(16);

    for (
        let column = 0;
        column < 4;
        column++
    ) {

        for (
            let row = 0;
            row < 4;
            row++
        ) {

            out[
                column * 4 + row
            ] =

                a[row] *
                b[column * 4] +

                a[4 + row] *
                b[column * 4 + 1] +

                a[8 + row] *
                b[column * 4 + 2] +

                a[12 + row] *
                b[column * 4 + 3];
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
        2 * far * near * nf,
        0
    ]);
}


function mat4Translation(
    x,
    y,
    z
) {

    const matrix =
        mat4Identity();

    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;

    return matrix;
}


function mat4RotationX(angle) {

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


function mat4RotationY(angle) {

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


/* ============================================================
   SHADERS
   ============================================================ */

/*
   A diferencia del anterior, vamos a utilizar:

       posición
       normal
       color
       tipo de material

   El material nos permitirá distinguir entre:

       0 = plástico negro
       1 = superficie plateada
*/

const vertexShaderSource = `

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute float aMaterial;

uniform mat4 uMatrix;

varying vec3 vNormal;
varying vec3 vColor;
varying float vMaterial;

void main() {

    gl_Position =
        uMatrix *
        vec4(
            aPosition,
            1.0
        );

    vNormal =
        normalize(aNormal);

    vColor =
        aColor;

    vMaterial =
        aMaterial;
}
`;


/* ============================================================
   FRAGMENT SHADER
   ============================================================ */

const fragmentShaderSource = `

precision highp float;

varying vec3 vNormal;
varying vec3 vColor;
varying float vMaterial;

void main() {

    vec3 N =
        normalize(vNormal);


    /*
       Luz principal superior izquierda.
    */

    vec3 lightA =
        normalize(
            vec3(
                -0.55,
                 0.90,
                 0.70
            )
        );


    /*
       Luz secundaria.
    */

    vec3 lightB =
        normalize(
            vec3(
                 0.80,
                 0.15,
                -0.35
            )
        );


    float diffuseA =
        max(
            dot(
                N,
                lightA
            ),
            0.0
        );


    float diffuseB =
        max(
            dot(
                N,
                lightB
            ),
            0.0
        );


    /*
       Iluminación base.
    */

    float lighting =
        0.50 +
        diffuseA * 0.34 +
        diffuseB * 0.16;


    vec3 color =
        vColor *
        lighting;


    /*
       ========================================================
       MATERIAL PLATEADO
       ========================================================
    */

    if (
        vMaterial > 0.5
    ) {

        /*
           Banda brillante.

           Esto simula de forma sencilla el efecto
           del acabado metálico/cepillado.
        */

        vec3 highlightLight =
            normalize(
                vec3(
                    -0.20,
                     0.85,
                     0.55
                )
            );


        float specular =
            pow(
                max(
                    dot(
                        N,
                        highlightLight
                    ),
                    0.0
                ),
                46.0
            );


        color +=
            vec3(
                1.00,
                0.78,
                0.20
            ) *
            specular;


        /*
           Reflejo frío suave en los bordes.
        */

        float rim =
            1.0 -
            abs(
                dot(
                    N,
                    vec3(
                        0.0,
                        0.0,
                        1.0
                    )
                )
            );


        rim =
            pow(
                rim,
                3.2
            );


        color +=
            vec3(
                0.18,
                0.08,
                0.01
            ) *
            rim;


        /*
           Elevamos ligeramente el plateado
           para evitar el gris apagado.
        */

        color =
            mix(
                color,
                vec3(
                    1.00,
                    0.72,
                    0.06
                ),
                0.10
            );
    }


    /*
       ========================================================
       PLÁSTICO NEGRO
       ========================================================
    */

    else {

        color +=
            vec3(
                0.015,
                0.018,
                0.025
            );
    }


    gl_FragColor =
        vec4(
            clamp(
                color,
                vec3(0.0),
                vec3(1.0)
            ),
            1.0
        );
}
`;


/* ============================================================
   COMPILAR SHADER
   ============================================================ */

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
            "❌ Error compilando shader:",
            gl.getShaderInfoLog(shader)
        );

        gl.deleteShader(shader);

        return null;
    }

    return shader;
}


/* ============================================================
   CREAR PROGRAMA WEBGL
   ============================================================ */

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
        "❌ Error enlazando shaders:",
        gl.getProgramInfoLog(program)
    );

    return;
}


gl.useProgram(program);


/* ============================================================
   ATRIBUTOS + UNIFORMS
   ============================================================ */

const aPosition =
    gl.getAttribLocation(
        program,
        "aPosition"
    );


const aNormal =
    gl.getAttribLocation(
        program,
        "aNormal"
    );


const aColor =
    gl.getAttribLocation(
        program,
        "aColor"
    );


const aMaterial =
    gl.getAttribLocation(
        program,
        "aMaterial"
    );


const uMatrix =
    gl.getUniformLocation(
        program,
        "uMatrix"
    );


/* ============================================================
   BUFFERS
   ============================================================ */

const positionBuffer =
    gl.createBuffer();


const normalBuffer =
    gl.createBuffer();


const colorBuffer =
    gl.createBuffer();


const materialBuffer =
    gl.createBuffer();


let vertexCount = 0;


/* ============================================================
   PALETA DEL MIRROR
   ============================================================ */

/*
   El cuerpo interior es prácticamente negro.
*/

const PLASTIC_BLACK = [
    0.025,
    0.029,
    0.036
];


/*
   Variamos MUY ligeramente el plateado según la orientación.

   No son "colores" diferentes.

   Sirve para que el ojo pueda distinguir las caras del puzzle
   con más facilidad.
*/

const SILVER = {

    PX: [
        0.94,
        0.55,
        0.025
    ],

    NX: [
        0.73,
        0.34,
        0.010
    ],

    PY: [
        1.00,
        0.76,
        0.075
    ],

    NY: [
        0.61,
        0.27,
        0.008
    ],

    PZ: [
        1.00,
        0.65,
        0.025
    ],

    NZ: [
        0.69,
        0.31,
        0.008
    ]
};


/* ============================================================
   ESTADO DE PIEZAS
   ============================================================ */

let pieces = [];

let nextPieceId = 0;


/*
   Cada cubie tendrá:

   logical
       posición lógica del 3×3.

   center
       posición física actual.

   size
       dimensiones físicas propias.

   basisX/Y/Z
       orientación local.

   exposed
       qué superficies eran exteriores en el estado resuelto.
*/


/* ============================================================
   PARTE 2/4
   CONSTRUCCIÓN DEL MIRROR + GEOMETRÍA 3D
   ============================================================ */


/* ============================================================
   CREAR UNA PIEZA
   ============================================================ */

function createPiece(ix, iy, iz) {

    /*
       Límites físicos.

       SEAM crea solamente una separación muy fina.
    */

    const x0 =
        CUT_X[ix] + SEAM;

    const x1 =
        CUT_X[ix + 1] - SEAM;

    const y0 =
        CUT_Y[iy] + SEAM;

    const y1 =
        CUT_Y[iy + 1] - SEAM;

    const z0 =
        CUT_Z[iz] + SEAM;

    const z1 =
        CUT_Z[iz + 1] - SEAM;


    const logical = [
        ix - 1,
        iy - 1,
        iz - 1
    ];

    const center =
        logicalToCenter(logical);


    const size = [

        collisionSafeDimension(x1 - x0),

        collisionSafeDimension(y1 - y0),

        collisionSafeDimension(z1 - z0)
    ];


    return {

        id:
            nextPieceId++,

        /*
           Posición lógica.

           Siempre será:
               -1
                0
                1
        */

        logical:
            copy3(logical),


        homeLogical:
            copy3(logical),


        /*
           Tamaño físico propio.

           IMPORTANTE:
           nunca cambia durante los giros.
        */

        size,


        /*
           Posición física actual.
        */

        center,


        homeCenter:
            copy3(center),


        /*
           Base ortonormal local.

           Esto permite que una pieza rectangular
           conserve correctamente su orientación
           después de R, U, F, etc.
        */

        basisX: [
            1,
            0,
            0
        ],

        basisY: [
            0,
            1,
            0
        ],

        basisZ: [
            0,
            0,
            1
        ],


        /*
           Qué caras pertenecen originalmente
           al exterior del puzzle.

           Solamente estas reciben acabado plateado.
           Las interiores son plástico negro.
        */

        exposed: {

            px:
                ix === 2,

            nx:
                ix === 0,

            py:
                iy === 2,

            ny:
                iy === 0,

            pz:
                iz === 2,

            nz:
                iz === 0
        }
    };
}


/* ============================================================
   CONSTRUIR LAS 26 PIEZAS
   ============================================================ */

function buildMirror() {

    pieces = [];

    nextPieceId = 0;


    for (
        let ix = 0;
        ix < 3;
        ix++
    ) {

        for (
            let iy = 0;
            iy < 3;
            iy++
        ) {

            for (
                let iz = 0;
                iz < 3;
                iz++
            ) {

                /*
                   La posición 0,0,0 lógica es el núcleo.

                   No se renderiza.
                */

                if (
                    ix === 1 &&
                    iy === 1 &&
                    iz === 1
                ) {
                    continue;
                }


                pieces.push(
                    createPiece(
                        ix,
                        iy,
                        iz
                    )
                );
            }
        }
    }
}


/* ============================================================
   TRANSFORMACIÓN LOCAL → WORLD
   ============================================================ */

function localToWorld(
    piece,
    local
) {

    return [

        piece.center[0] +

        piece.basisX[0] *
        local[0] +

        piece.basisY[0] *
        local[1] +

        piece.basisZ[0] *
        local[2],


        piece.center[1] +

        piece.basisX[1] *
        local[0] +

        piece.basisY[1] *
        local[1] +

        piece.basisZ[1] *
        local[2],


        piece.center[2] +

        piece.basisX[2] *
        local[0] +

        piece.basisY[2] *
        local[1] +

        piece.basisZ[2] *
        local[2]
    ];
}


/* ============================================================
   NORMAL LOCAL → WORLD
   ============================================================ */

function normalToWorld(
    piece,
    normal
) {

    return normalize3([

        piece.basisX[0] *
        normal[0] +

        piece.basisY[0] *
        normal[1] +

        piece.basisZ[0] *
        normal[2],


        piece.basisX[1] *
        normal[0] +

        piece.basisY[1] *
        normal[1] +

        piece.basisZ[1] *
        normal[2],


        piece.basisX[2] *
        normal[0] +

        piece.basisY[2] *
        normal[1] +

        piece.basisZ[2] *
        normal[2]
    ]);
}


/* ============================================================
   AÑADIR VÉRTICE
   ============================================================ */

function addVertex(
    positions,
    normals,
    colors,
    materials,
    position,
    normal,
    color,
    material
) {

    positions.push(
        position[0],
        position[1],
        position[2]
    );


    normals.push(
        normal[0],
        normal[1],
        normal[2]
    );


    colors.push(
        color[0],
        color[1],
        color[2]
    );


    materials.push(
        material
    );
}


/* ============================================================
   AÑADIR TRIÁNGULO
   ============================================================ */

function addTriangle(
    positions,
    normals,
    colors,
    materials,
    a,
    b,
    c,
    normal,
    color,
    material
) {

    addVertex(
        positions,
        normals,
        colors,
        materials,
        a,
        normal,
        color,
        material
    );


    addVertex(
        positions,
        normals,
        colors,
        materials,
        b,
        normal,
        color,
        material
    );


    addVertex(
        positions,
        normals,
        colors,
        materials,
        c,
        normal,
        color,
        material
    );
}


/* ============================================================
   AÑADIR QUAD
   ============================================================ */

function addQuad(
    positions,
    normals,
    colors,
    materials,
    a,
    b,
    c,
    d,
    normal,
    color,
    material
) {

    addTriangle(
        positions,
        normals,
        colors,
        materials,

        a,
        b,
        c,

        normal,
        color,
        material
    );


    addTriangle(
        positions,
        normals,
        colors,
        materials,

        a,
        c,
        d,

        normal,
        color,
        material
    );
}


/* ============================================================
   QUAD LOCAL
   ============================================================ */

function addLocalQuad(
    piece,
    positions,
    normals,
    colors,
    materials,
    a,
    b,
    c,
    d,
    localNormal,
    color,
    material
) {

    addQuad(
        positions,
        normals,
        colors,
        materials,

        localToWorld(
            piece,
            a
        ),

        localToWorld(
            piece,
            b
        ),

        localToWorld(
            piece,
            c
        ),

        localToWorld(
            piece,
            d
        ),

        normalToWorld(
            piece,
            localNormal
        ),

        color,

        material
    );
}


/* ============================================================
   COLOR DE UNA CARA
   ============================================================ */

function faceColor(
    piece,
    face
) {

    /*
       Si originalmente esa cara era exterior,
       usamos plateado.

       Si era interior:
       plástico negro.
    */

    if (
        !piece.exposed[
            face
        ]
    ) {

        return {
            color:
                PLASTIC_BLACK,

            material:
                0
        };
    }


    switch (face) {

        case "px":

            return {
                color:
                    SILVER.PX,

                material:
                    1
            };


        case "nx":

            return {
                color:
                    SILVER.NX,

                material:
                    1
            };


        case "py":

            return {
                color:
                    SILVER.PY,

                material:
                    1
            };


        case "ny":

            return {
                color:
                    SILVER.NY,

                material:
                    1
            };


        case "pz":

            return {
                color:
                    SILVER.PZ,

                material:
                    1
            };


        case "nz":

            return {
                color:
                    SILVER.NZ,

                material:
                    1
            };
    }


    return {
        color:
            PLASTIC_BLACK,

        material:
            0
    };
}


/* ============================================================
   GEOMETRÍA BISELADA
   ============================================================ */

/*
   Cada pieza es básicamente una caja.

   PERO:

   en lugar de hacer:

       ┌──────────────┐
       │              │
       │              │
       └──────────────┘

   completamente cuadrada, hacemos:

          __________
        /            \
       |              |
       |              |
        \____________/

   El bisel es pequeño.

   Eso da un aspecto mucho más parecido a una
   pieza física de un puzzle.
*/

function appendBeveledPiece(
    piece,
    positions,
    normals,
    colors,
    materials
) {

    const hx =
        piece.size[0] / 2;

    const hy =
        piece.size[1] / 2;

    const hz =
        piece.size[2] / 2;


    /*
       El bisel nunca puede ser mayor que una
       fracción de la pieza más pequeña.
    */

    const bevel =
        Math.min(
            BEVEL,

            hx * 0.18,
            hy * 0.18,
            hz * 0.18
        );


    const ix =
        Math.max(
            0.01,
            hx - bevel
        );

    const iy =
        Math.max(
            0.01,
            hy - bevel
        );

    const iz =
        Math.max(
            0.01,
            hz - bevel
        );


    /* ========================================================
       MATERIALES DE LAS 6 CARAS
       ======================================================== */

    const PX =
        faceColor(
            piece,
            "px"
        );

    const NX =
        faceColor(
            piece,
            "nx"
        );

    const PY =
        faceColor(
            piece,
            "py"
        );

    const NY =
        faceColor(
            piece,
            "ny"
        );

    const PZ =
        faceColor(
            piece,
            "pz"
        );

    const NZ =
        faceColor(
            piece,
            "nz"
        );


    /* ========================================================
       CARA +Z
       ======================================================== */

    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-ix, -iy,  hz],
        [ ix, -iy,  hz],
        [ ix,  iy,  hz],
        [-ix,  iy,  hz],

        [0, 0, 1],

        PZ.color,
        PZ.material
    );


    /* ========================================================
       CARA -Z
       ======================================================== */

    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ ix, -iy, -hz],
        [-ix, -iy, -hz],
        [-ix,  iy, -hz],
        [ ix,  iy, -hz],

        [0, 0, -1],

        NZ.color,
        NZ.material
    );


    /* ========================================================
       CARA +X
       ======================================================== */

    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ hx, -iy,  iz],
        [ hx, -iy, -iz],
        [ hx,  iy, -iz],
        [ hx,  iy,  iz],

        [1, 0, 0],

        PX.color,
        PX.material
    );


    /* ========================================================
       CARA -X
       ======================================================== */

    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-hx, -iy, -iz],
        [-hx, -iy,  iz],
        [-hx,  iy,  iz],
        [-hx,  iy, -iz],

        [-1, 0, 0],

        NX.color,
        NX.material
    );


    /* ========================================================
       CARA +Y
       ======================================================== */

    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-ix,  hy,  iz],
        [ ix,  hy,  iz],
        [ ix,  hy, -iz],
        [-ix,  hy, -iz],

        [0, 1, 0],

        PY.color,
        PY.material
    );


    /* ========================================================
       CARA -Y
       ======================================================== */

    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-ix, -hy, -iz],
        [ ix, -hy, -iz],
        [ ix, -hy,  iz],
        [-ix, -hy,  iz],

        [0, -1, 0],

        NY.color,
        NY.material
    );


    /* ========================================================
       BISELES
       ========================================================

       Los biseles usan un plateado algo más oscuro
       cuando conectan con una cara exterior.

       En caras interiores permanecen negros.
    */


    const bevelSilver = [
        0.012,
        0.010,
        0.008
    ];


    /*
       Devuelve material para un borde.

       Si cualquiera de las dos caras es exterior,
       mostramos metal oscuro.

       Si ambas son interiores:
       negro.
    */

    function edgeMaterial(
        faceA,
        faceB
    ) {

        if (
            piece.exposed[
                faceA
            ] ||
            piece.exposed[
                faceB
            ]
        ) {

            return {
                color:
                    bevelSilver,

                material:
                    0
            };
        }


        return {
            color:
                PLASTIC_BLACK,

            material:
                0
        };
    }


    /* ========================================================
       BORDES PARALELOS A X
       ======================================================== */

    const edgeX_PY_PZ =
        edgeMaterial(
            "py",
            "pz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-ix,  hy,  iz],
        [ ix,  hy,  iz],
        [ ix,  iy,  hz],
        [-ix,  iy,  hz],

        normalize3([
            0,
            1,
            1
        ]),

        edgeX_PY_PZ.color,
        edgeX_PY_PZ.material
    );


    const edgeX_PY_NZ =
        edgeMaterial(
            "py",
            "nz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ ix,  hy, -iz],
        [-ix,  hy, -iz],
        [-ix,  iy, -hz],
        [ ix,  iy, -hz],

        normalize3([
            0,
            1,
            -1
        ]),

        edgeX_PY_NZ.color,
        edgeX_PY_NZ.material
    );


    const edgeX_NY_PZ =
        edgeMaterial(
            "ny",
            "pz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ ix, -hy,  iz],
        [-ix, -hy,  iz],
        [-ix, -iy,  hz],
        [ ix, -iy,  hz],

        normalize3([
            0,
            -1,
            1
        ]),

        edgeX_NY_PZ.color,
        edgeX_NY_PZ.material
    );


    const edgeX_NY_NZ =
        edgeMaterial(
            "ny",
            "nz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-ix, -hy, -iz],
        [ ix, -hy, -iz],
        [ ix, -iy, -hz],
        [-ix, -iy, -hz],

        normalize3([
            0,
            -1,
            -1
        ]),

        edgeX_NY_NZ.color,
        edgeX_NY_NZ.material
    );


    /* ========================================================
       BORDES PARALELOS A Y
       ======================================================== */

    const edgeY_PX_PZ =
        edgeMaterial(
            "px",
            "pz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ hx, -iy,  iz],
        [ hx,  iy,  iz],
        [ ix,  iy,  hz],
        [ ix, -iy,  hz],

        normalize3([
            1,
            0,
            1
        ]),

        edgeY_PX_PZ.color,
        edgeY_PX_PZ.material
    );


    const edgeY_PX_NZ =
        edgeMaterial(
            "px",
            "nz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ hx,  iy, -iz],
        [ hx, -iy, -iz],
        [ ix, -iy, -hz],
        [ ix,  iy, -hz],

        normalize3([
            1,
            0,
            -1
        ]),

        edgeY_PX_NZ.color,
        edgeY_PX_NZ.material
    );


    const edgeY_NX_PZ =
        edgeMaterial(
            "nx",
            "pz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-hx,  iy,  iz],
        [-hx, -iy,  iz],
        [-ix, -iy,  hz],
        [-ix,  iy,  hz],

        normalize3([
            -1,
            0,
            1
        ]),

        edgeY_NX_PZ.color,
        edgeY_NX_PZ.material
    );


    const edgeY_NX_NZ =
        edgeMaterial(
            "nx",
            "nz"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-hx, -iy, -iz],
        [-hx,  iy, -iz],
        [-ix,  iy, -hz],
        [-ix, -iy, -hz],

        normalize3([
            -1,
            0,
            -1
        ]),

        edgeY_NX_NZ.color,
        edgeY_NX_NZ.material
    );


    /* ========================================================
       BORDES PARALELOS A Z
       ======================================================== */

    const edgeZ_PX_PY =
        edgeMaterial(
            "px",
            "py"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ hx,  iy, -iz],
        [ hx,  iy,  iz],
        [ ix,  hy,  iz],
        [ ix,  hy, -iz],

        normalize3([
            1,
            1,
            0
        ]),

        edgeZ_PX_PY.color,
        edgeZ_PX_PY.material
    );


    const edgeZ_PX_NY =
        edgeMaterial(
            "px",
            "ny"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [ hx, -iy,  iz],
        [ hx, -iy, -iz],
        [ ix, -hy, -iz],
        [ ix, -hy,  iz],

        normalize3([
            1,
            -1,
            0
        ]),

        edgeZ_PX_NY.color,
        edgeZ_PX_NY.material
    );


    const edgeZ_NX_PY =
        edgeMaterial(
            "nx",
            "py"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-hx,  iy,  iz],
        [-hx,  iy, -iz],
        [-ix,  hy, -iz],
        [-ix,  hy,  iz],

        normalize3([
            -1,
            1,
            0
        ]),

        edgeZ_NX_PY.color,
        edgeZ_NX_PY.material
    );


    const edgeZ_NX_NY =
        edgeMaterial(
            "nx",
            "ny"
        );


    addLocalQuad(
        piece,
        positions,
        normals,
        colors,
        materials,

        [-hx, -iy, -iz],
        [-hx, -iy,  iz],
        [-ix, -hy,  iz],
        [-ix, -hy, -iz],

        normalize3([
            -1,
            -1,
            0
        ]),

        edgeZ_NX_NY.color,
        edgeZ_NX_NY.material
    );


    /* ========================================================
       ESQUINAS BISELADAS
       ======================================================== */

    /*
       Ocho triángulos pequeños cierran las esquinas.
    */

    function cornerMaterial(
        faceX,
        faceY,
        faceZ
    ) {

        if (
            piece.exposed[
                faceX
            ] ||
            piece.exposed[
                faceY
            ] ||
            piece.exposed[
                faceZ
            ]
        ) {

            return {
                color:
                    bevelSilver,

                material:
                    0
            };
        }


        return {
            color:
                PLASTIC_BLACK,

            material:
                0
        };
    }


    function addCorner(
        sx,
        sy,
        sz,
        faceX,
        faceY,
        faceZ
    ) {

        const corner =
            cornerMaterial(
                faceX,
                faceY,
                faceZ
            );


        const a = [
            sx * hx,
            sy * iy,
            sz * iz
        ];


        const b = [
            sx * ix,
            sy * hy,
            sz * iz
        ];


        const c = [
            sx * ix,
            sy * iy,
            sz * hz
        ];


        /*
           Orden del triángulo dependiendo del
           signo de la esquina.
        */

        let p1 = a;
        let p2 = b;
        let p3 = c;


        if (
            sx * sy * sz <
            0
        ) {

            p2 = c;
            p3 = b;
        }


        const normal =
            normalize3([
                sx,
                sy,
                sz
            ]);


        addTriangle(
            positions,
            normals,
            colors,
            materials,

            localToWorld(
                piece,
                p1
            ),

            localToWorld(
                piece,
                p2
            ),

            localToWorld(
                piece,
                p3
            ),

            normalToWorld(
                piece,
                normal
            ),

            corner.color,

            corner.material
        );
    }


    addCorner(
         1,
         1,
         1,
        "px",
        "py",
        "pz"
    );


    addCorner(
         1,
         1,
        -1,
        "px",
        "py",
        "nz"
    );


    addCorner(
         1,
        -1,
         1,
        "px",
        "ny",
        "pz"
    );


    addCorner(
         1,
        -1,
        -1,
        "px",
        "ny",
        "nz"
    );


    addCorner(
        -1,
         1,
         1,
        "nx",
        "py",
        "pz"
    );


    addCorner(
        -1,
         1,
        -1,
        "nx",
        "py",
        "nz"
    );


    addCorner(
        -1,
        -1,
         1,
        "nx",
        "ny",
        "pz"
    );


    addCorner(
        -1,
        -1,
        -1,
        "nx",
        "ny",
        "nz"
    );
}


/* ============================================================
   RECONSTRUIR GEOMETRÍA
   ============================================================ */

function rebuildGeometry() {

    const positions = [];

    const normals = [];

    const colors = [];

    const materials = [];


    for (
        const piece
        of pieces
    ) {

        appendBeveledPiece(
            piece,
            positions,
            normals,
            colors,
            materials
        );
    }


    vertexCount =
        positions.length / 3;


    /* ========================================================
       POSITION BUFFER
       ======================================================== */

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


    /* ========================================================
       NORMAL BUFFER
       ======================================================== */

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


    /* ========================================================
       COLOR BUFFER
       ======================================================== */

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


    /* ========================================================
       MATERIAL BUFFER
       ======================================================== */

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        materialBuffer
    );


    gl.bufferData(
        gl.ARRAY_BUFFER,

        new Float32Array(
            materials
        ),

        gl.DYNAMIC_DRAW
    );
}


/* ============================================================
   COMPROBAR EL MIRROR
   ============================================================ */

function validateMirror() {

    if (
        pieces.length !== 26
    ) {

        console.error(
            "❌ Mirror inválido:",
            pieces.length,
            "piezas visibles"
        );

        return false;
    }


    /*
       Cada capa exterior tiene que contener
       exactamente nueve cubies.
    */

    const checks = [

        ["R", 0,  1],
        ["L", 0, -1],

        ["U", 1,  1],
        ["D", 1, -1],

        ["F", 2,  1],
        ["B", 2, -1]
    ];


    for (
        const [
            name,
            axis,
            layer
        ]
        of checks
    ) {

        const count =
            pieces.filter(
                piece =>

                    piece.logical[
                        axis
                    ] ===
                    layer
            ).length;


        if (
            count !== 9
        ) {

            console.error(
                `❌ Capa ${name}:`,
                count,
                "piezas"
            );

            return false;
        }
    }


    console.log(
        "✅ Mirror:",
        pieces.length,
        "cubies visibles"
    );


    console.log(
        "✅ Todas las capas contienen 9 piezas"
    );


    return true;
}


/* ============================================================
   PARTE 3/4
   MOVIMIENTOS + ANIMACIÓN + SCRAMBLE + SOLVE
   ============================================================ */


/* ============================================================
   DEFINICIÓN DE MOVIMIENTOS
   ============================================================ */

/*
   logical:

       X = izquierda / derecha
       Y = abajo / arriba
       Z = atrás / frente

   Cada movimiento selecciona exactamente una capa de 9 piezas.
*/

const MOVES = {

    U: {
        axis: [0, 1, 0],
        axisIndex: 1,
        layer: 1,
        direction: -1
    },

    D: {
        axis: [0, 1, 0],
        axisIndex: 1,
        layer: -1,
        direction: 1
    },

    R: {
        axis: [1, 0, 0],
        axisIndex: 0,
        layer: 1,
        direction: -1
    },

    L: {
        axis: [1, 0, 0],
        axisIndex: 0,
        layer: -1,
        direction: 1
    },

    F: {
        axis: [0, 0, 1],
        axisIndex: 2,
        layer: 1,
        direction: -1
    },

    B: {
        axis: [0, 0, 1],
        axisIndex: 2,
        layer: -1,
        direction: 1
    }
};


/* ============================================================
   ESTADO DE MOVIMIENTOS
   ============================================================ */

let activeMove = null;

let moveQueue = [];

let moveHistory = [];

let moveCounter = 0;


/* ============================================================
   CONTADOR
   ============================================================ */

function updateMoveCounter() {

    if (counterEl) {
        counterEl.textContent =
            String(moveCounter);
    }
}


/* ============================================================
   INTERPRETAR MOVIMIENTO
   ============================================================ */

function parseMove(notation) {

    if (!notation) {
        return null;
    }


    const text =
        String(notation)
            .trim()
            .toUpperCase();


    const base =
        text.charAt(0);


    if (!MOVES[base]) {
        return null;
    }


    const inverse =
        text.includes("'");


    return {

        base,

        inverse,

        notation:
            base +
            (
                inverse
                    ? "'"
                    : ""
            )
    };
}


/* ============================================================
   MOVIMIENTO INVERSO
   ============================================================ */

function inverseMove(notation) {

    const parsed =
        parseMove(notation);


    if (!parsed) {
        return null;
    }


    if (parsed.inverse) {
        return parsed.base;
    }


    return (
        parsed.base +
        "'"
    );
}


/* ============================================================
   ROTAR POSICIÓN LÓGICA
   ============================================================ */

/*
   Esta función NO trabaja con dimensiones físicas.

   Solamente actualiza la posición lógica dentro del 3×3.

   Ejemplo:

       [1, 1, 1]

   después de ciertos giros puede pasar a:

       [1, 1, -1]

   Esto nos permite seguir seleccionando correctamente
   las capas aunque el Mirror esté completamente mezclado.
*/

function rotateLogicalPosition(
    logical,
    axisIndex,
    direction
) {

    const x =
        logical[0];

    const y =
        logical[1];

    const z =
        logical[2];


    /* ========================================================
       EJE X
       ======================================================== */

    if (axisIndex === 0) {

        if (direction > 0) {

            return [
                x,
                -z,
                y
            ];
        }


        return [
            x,
            z,
            -y
        ];
    }


    /* ========================================================
       EJE Y
       ======================================================== */

    if (axisIndex === 1) {

        if (direction > 0) {

            return [
                z,
                y,
                -x
            ];
        }


        return [
            -z,
            y,
            x
        ];
    }


    /* ========================================================
       EJE Z
       ======================================================== */

    if (direction > 0) {

        return [
            -y,
            x,
            z
        ];
    }


    return [
        y,
        -x,
        z
    ];
}


/* ============================================================
   OBTENER PIEZAS DE UNA CAPA
   ============================================================ */

function getLayerPieces(
    axisIndex,
    layer
) {

    return pieces.filter(
        piece =>

            piece.logical[
                axisIndex
            ] === layer
    );
}


/* ============================================================
   COMPROBAR CAPA
   ============================================================ */

function validateLayer(
    notation,
    layerPieces
) {

    if (
        layerPieces.length === 9
    ) {
        return true;
    }


    console.error(
        "❌ Movimiento",
        notation,
        "seleccionó",
        layerPieces.length,
        "piezas en vez de 9."
    );


    return false;
}


/* ============================================================
   CREAR SNAPSHOT
   ============================================================ */

/*
   ESTO ES MUY IMPORTANTE.

   Las nueve piezas se guardan ANTES de empezar el giro.

   Durante toda la animación calculamos:

       estadoActual =
           rotación(t) × estadoInicial

   y NO:

       estadoActual =
           rotaciónPequeña × estadoDelFrameAnterior

   De esta manera evitamos acumulación de errores y las
   nueve piezas giran como un conjunto rígido.
*/

function createMoveSnapshot(
    layerPieces
) {

    return layerPieces.map(
        piece => ({

            piece,

            center:
                copy3(
                    piece.center
                ),

            basisX:
                copy3(
                    piece.basisX
                ),

            basisY:
                copy3(
                    piece.basisY
                ),

            basisZ:
                copy3(
                    piece.basisZ
                ),

            logical:
                copy3(
                    piece.logical
                )
        })
    );
}


/* ============================================================
   INICIAR MOVIMIENTO
   ============================================================ */

function startMove(
    notation,
    options = {}
) {

    if (activeMove) {
        return false;
    }


    const parsed =
        parseMove(notation);


    if (!parsed) {

        console.warn(
            "⚠️ Movimiento desconocido:",
            notation
        );

        return false;
    }


    const definition =
        MOVES[
            parsed.base
        ];


    const layerPieces =
        getLayerPieces(
            definition.axisIndex,
            definition.layer
        );


    if (
        !validateLayer(
            parsed.notation,
            layerPieces
        )
    ) {
        return false;
    }


    /*
       ' significa dirección contraria.
    */

    const direction =

        definition.direction *

        (
            parsed.inverse
                ? -1
                : 1
        );


    activeMove = {

        notation:
            parsed.notation,

        base:
            parsed.base,

        definition,

        direction,

        snapshots:
            createMoveSnapshot(
                layerPieces
            ),

        startTime:
            performance.now(),

        duration:
            options.duration ??
            MOVE_DURATION,

        record:
            options.record !== false,

        count:
            options.count !== false,

        source:
            options.source ??
            "manual"
    };


    setStatus(
        `🪞 Girando ${parsed.notation}...`
    );


    return true;
}


/* ============================================================
   APLICAR ROTACIÓN TEMPORAL
   ============================================================ */

function applyAnimatedRotation(
    move,
    angle
) {

    /*
       Todas las piezas usan:

           mismo eje
           mismo ángulo
           mismo origen

       Eso es lo que hace que la capa sea rígida.
    */

    for (
        const snapshot
        of move.snapshots
    ) {

        const piece =
            snapshot.piece;


        /* ----------------------------------------------------
           POSICIÓN
           ---------------------------------------------------- */

        piece.center =
            rotateVector(
                snapshot.center,
                move.definition.axis,
                angle
            );


        /* ----------------------------------------------------
           ORIENTACIÓN LOCAL X
           ---------------------------------------------------- */

        piece.basisX =
            rotateVector(
                snapshot.basisX,
                move.definition.axis,
                angle
            );


        /* ----------------------------------------------------
           ORIENTACIÓN LOCAL Y
           ---------------------------------------------------- */

        piece.basisY =
            rotateVector(
                snapshot.basisY,
                move.definition.axis,
                angle
            );


        /* ----------------------------------------------------
           ORIENTACIÓN LOCAL Z
           ---------------------------------------------------- */

        piece.basisZ =
            rotateVector(
                snapshot.basisZ,
                move.definition.axis,
                angle
            );
    }
}


/* ============================================================
   ANIMAR MOVIMIENTO
   ============================================================ */

function animateActiveMove(now) {

    if (!activeMove) {
        return;
    }


    const elapsed =
        now -
        activeMove.startTime;


    const rawProgress =
        clamp(
            elapsed /
            activeMove.duration,
            0,
            1
        );


    const progress =
        easeInOutCubic(
            rawProgress
        );


    const angle =

        activeMove.direction *

        HALF_PI *

        progress;


    applyAnimatedRotation(
        activeMove,
        angle
    );


    /*
       La geometría cambia durante el giro,
       así que actualizamos los buffers.
    */

    rebuildGeometry();


    if (
        rawProgress >= 1
    ) {

        finishActiveMove();
    }
}


/* ============================================================
   FINALIZAR MOVIMIENTO
   ============================================================ */

function finishActiveMove() {

    if (!activeMove) {
        return;
    }


    const move =
        activeMove;


    const finalAngle =

        move.direction *

        HALF_PI;


    /*
       IMPORTANTE:

       Al terminar NO conservamos el último frame.

       Volvemos a calcular directamente desde el snapshot
       utilizando exactamente 90°.

       Luego hacemos snap.

       Esto evita que el Mirror vaya deformándose por
       errores numéricos después de muchos movimientos.
    */

    for (
        const snapshot
        of move.snapshots
    ) {

        const piece =
            snapshot.piece;


        /* ----------------------------------------------------
           POSICIÓN LÓGICA FINAL

           Primero calculamos la casilla del mecanismo regular.
           El centro físico se ajusta después exactamente a esa
           casilla para impedir deriva y superposición de piezas.
           ---------------------------------------------------- */

        piece.logical =
            rotateLogicalPosition(
                snapshot.logical,
                move.definition.axisIndex,
                move.direction
            );

        piece.center =
            logicalToCenter(
                piece.logical
            );


        /* ----------------------------------------------------
           ORIENTACIÓN X FINAL
           ---------------------------------------------------- */

        piece.basisX =
            snapVector(
                rotateVector(
                    snapshot.basisX,
                    move.definition.axis,
                    finalAngle
                )
            );


        /* ----------------------------------------------------
           ORIENTACIÓN Y FINAL
           ---------------------------------------------------- */

        piece.basisY =
            snapVector(
                rotateVector(
                    snapshot.basisY,
                    move.definition.axis,
                    finalAngle
                )
            );


        /* ----------------------------------------------------
           ORIENTACIÓN Z FINAL
           ---------------------------------------------------- */

        piece.basisZ =
            snapVector(
                rotateVector(
                    snapshot.basisZ,
                    move.definition.axis,
                    finalAngle
                )
            );


    }


    /* ========================================================
       HISTORIAL
       ======================================================== */

    if (move.record) {

        moveHistory.push(
            move.notation
        );
    }


    /* ========================================================
       CONTADOR
       ======================================================== */

    if (move.count) {

        moveCounter++;

        updateMoveCounter();
    }


    const source =
        move.source;


    activeMove = null;


    rebuildGeometry();


    /*
       Solamente cambiamos el estado cuando ya no queda
       otro movimiento esperando.
    */

    if (
        moveQueue.length === 0
    ) {

        if (
            source === "solve" &&
            moveHistory.length === 0
        ) {

            setStatus(
                "✨ Mirror Cube resuelto"
            );

        } else {

            setStatus(
                "🪞 Mirror Cube listo"
            );
        }
    }
}


/* ============================================================
   COLA DE MOVIMIENTOS
   ============================================================ */

function enqueueMove(
    notation,
    options = {}
) {

    const parsed =
        parseMove(notation);


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


/* ============================================================
   PROCESAR COLA
   ============================================================ */

function processMoveQueue() {

    if (activeMove) {
        return;
    }


    if (
        moveQueue.length === 0
    ) {
        return;
    }


    const next =
        moveQueue.shift();


    startMove(
        next.notation,
        next.options
    );
}


/* ============================================================
   MOVIMIENTO MANUAL
   ============================================================ */

function performMove(
    notation
) {

    /*
       Mientras hay una secuencia automática no dejamos
       introducir otro movimiento de capa.

       OJO:
       esto NO bloqueará la cámara.
       La cámara se mantiene independiente en la Parte 4.
    */

    if (
        activeMove ||
        moveQueue.length > 0
    ) {

        return false;
    }


    return startMove(
        notation,
        {

            duration:
                MOVE_DURATION,

            record:
                true,

            count:
                true,

            source:
                "manual"
        }
    );
}


/* ============================================================
   BOTONES U D L R F B
   ============================================================ */

moveButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const notation =
                    button.dataset.move;


                performMove(
                    notation
                );
            }
        );
    }
);


/* ============================================================
   GENERAR SCRAMBLE
   ============================================================ */

function generateScramble(
    length = 22
) {

    const bases = [
        "U",
        "D",
        "L",
        "R",
        "F",
        "B"
    ];


    /*
       Evitamos movimientos consecutivos del mismo eje.

       Ejemplo:

           R L R

       no aporta mucho visualmente a una mezcla.
    */

    const axisGroup = {

        U: "Y",
        D: "Y",

        L: "X",
        R: "X",

        F: "Z",
        B: "Z"
    };


    const result = [];


    let previousAxis =
        null;


    for (
        let i = 0;
        i < length;
        i++
    ) {

        let base;


        do {

            base =
                bases[
                    Math.floor(
                        Math.random() *
                        bases.length
                    )
                ];

        } while (
            axisGroup[base] ===
            previousAxis
        );


        previousAxis =
            axisGroup[base];


        /*
           50% normal
           50% inverso
        */

        const inverse =
            Math.random() <
            0.5;


        result.push(
            base +
            (
                inverse
                    ? "'"
                    : ""
            )
        );
    }


    return result;
}


/* ============================================================
   MEZCLAR
   ============================================================ */

function scrambleMirror() {

    if (
        activeMove ||
        moveQueue.length > 0
    ) {

        return;
    }


    const scramble =
        generateScramble(22);


    console.log(
        "🔀 Scramble:",
        scramble.join(" ")
    );


    for (
        const notation
        of scramble
    ) {

        enqueueMove(
            notation,
            {

                duration:
                    SCRAMBLE_DURATION,

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
        "🔀 Mezclando Mirror Cube..."
    );
}


/* ============================================================
   RESOLVER MEDIANTE HISTORIAL
   ============================================================ */

/*
   Como easyRubik conoce todos los movimientos realizados,
   podemos resolver reproduciendo exactamente el historial
   en orden inverso.

   Ejemplo:

       R U F'

   solución:

       F U' R'
*/

function solveMirror() {

    if (
        activeMove ||
        moveQueue.length > 0
    ) {

        return;
    }


    if (
        moveHistory.length === 0
    ) {

        setStatus(
            "✨ El Mirror Cube ya está resuelto"
        );

        return;
    }


    const solution =

        [...moveHistory]

            .reverse()

            .map(
                inverseMove
            )

            .filter(Boolean);


    console.log(
        "✨ Solución:",
        solution.join(" ")
    );


    /*
       IMPORTANTE:

       Limpiamos el historial ANTES de reproduccir
       la solución.

       Los movimientos de solve usan:

           record: false

       por lo que no volverán a agregarse.
    */

    moveHistory = [];


    for (
        const notation
        of solution
    ) {

        enqueueMove(
            notation,
            {

                duration:
                    SOLVE_DURATION,

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
        "✨ Resolviendo Mirror Cube..."
    );
}


/* ============================================================
   REINICIAR ESTADO DEL PUZZLE
   ============================================================ */

function resetMirrorState() {

    /*
       Cancelamos cualquier animación.
    */

    activeMove = null;


    /*
       Vaciamos cola.
    */

    moveQueue = [];


    /*
       Vaciamos historial.
    */

    moveHistory = [];


    /*
       Reiniciamos contador.
    */

    moveCounter = 0;


    /*
       Reconstruimos físicamente las 26 piezas desde cero.
    */

    buildMirror();


    rebuildGeometry();


    updateMoveCounter();


    setStatus(
        "↺ Mirror Cube reiniciado"
    );


    console.log(
        "↺ Mirror Cube reiniciado"
    );
}


/* ============================================================
   BOTÓN MEZCLAR
   ============================================================ */

if (btnScramble) {

    btnScramble.addEventListener(
        "click",
        () => {

            scrambleMirror();
        }
    );
}


/* ============================================================
   BOTÓN RESOLVER
   ============================================================ */

if (btnSolve) {

    btnSolve.addEventListener(
        "click",
        () => {

            solveMirror();
        }
    );
}


/* ============================================================
   BOTÓN REINICIAR
   ============================================================ */

if (btnReset) {

    btnReset.addEventListener(
        "click",
        () => {

            resetMirrorState();
        }
    );
}


/* ============================================================
   TEST: MOVIMIENTO + INVERSO
   ============================================================ */

/*
   Esta función no se ejecuta automáticamente.

   Desde la consola puedes hacer:

       easyRubikMirror.testMove("R")

   y comprobar:

       R
       R'

   También sirve con U, F, etc.
*/

function testMoveAndInverse(
    notation
) {

    const parsed =
        parseMove(notation);


    if (!parsed) {

        console.warn(
            "Movimiento inválido"
        );

        return;
    }


    if (
        activeMove ||
        moveQueue.length
    ) {

        console.warn(
            "Espera a que termine la animación."
        );

        return;
    }


    enqueueMove(
        parsed.notation,
        {

            duration:
                500,

            record:
                false,

            count:
                false,

            source:
                "test"
        }
    );


    enqueueMove(
        inverseMove(
            parsed.notation
        ),
        {

            duration:
                500,

            record:
                false,

            count:
                false,

            source:
                "test"
        }
    );


    console.log(
        "🧪 Test:",
        parsed.notation,
        inverseMove(
            parsed.notation
        )
    );
}

/* ============================================================
   PARTE 4/4
   CÁMARA + MOUSE + ZOOM + TECLADO + RENDER + ARRANQUE
   ============================================================ */


/* ============================================================
   ESTADO DE LA CÁMARA
   ============================================================ */

let cameraYaw = -0.62;
let cameraPitch = 0.34;
let cameraDistance = 8.0;

let targetYaw = cameraYaw;
let targetPitch = cameraPitch;
let targetDistance = cameraDistance;


/*
   Sensibilidad del mouse.

   Si después quieres hacerlo más rápido/lento,
   solamente modificamos este número.
*/

const CAMERA_SENSITIVITY = 0.006;


/* ============================================================
   CENTRAR CÁMARA
   ============================================================ */

function resetCamera() {

    targetYaw = -0.62;
    targetPitch = 0.34;
    targetDistance = 8.0;
}


/* ============================================================
   BOTÓN CENTRAR
   ============================================================ */

if (btnCamera) {

    btnCamera.addEventListener(
        "click",
        () => {

            resetCamera();

            setStatus(
                "🎯 Cámara centrada"
            );
        }
    );
}


/* ============================================================
   ESTADO DEL MOUSE
   ============================================================ */

let draggingCamera = false;

let activePointerId = null;

let previousPointerX = 0;
let previousPointerY = 0;


/*
   Evita gestos del navegador sobre el canvas.
*/

canvas.style.touchAction = "none";

canvas.style.cursor = "grab";


/* ============================================================
   MOUSE / POINTER DOWN
   ============================================================ */

canvas.addEventListener(
    "pointerdown",
    event => {

        /*
           IMPORTANTE:

           La cámara NO depende de activeMove.

           Por eso podrás moverla incluso mientras el
           Mirror se está mezclando o resolviendo.
        */

        draggingCamera = true;

        activePointerId =
            event.pointerId;

        previousPointerX =
            event.clientX;

        previousPointerY =
            event.clientY;

        canvas.style.cursor =
            "grabbing";


        try {

            canvas.setPointerCapture(
                event.pointerId
            );

        } catch (error) {

            /*
               Algunos navegadores pueden no permitirlo.
               No es grave.
            */
        }


        event.preventDefault();
    }
);


/* ============================================================
   MOUSE / POINTER MOVE
   ============================================================ */

canvas.addEventListener(
    "pointermove",
    event => {

        if (!draggingCamera) {
            return;
        }


        if (
            event.pointerId !==
            activePointerId
        ) {
            return;
        }


        const dx =
            event.clientX -
            previousPointerX;


        const dy =
            event.clientY -
            previousPointerY;


        /*
           ====================================================
           MOVIMIENTO HORIZONTAL
           ====================================================

           Arrastras hacia la derecha:
               el puzzle acompaña hacia la derecha.

           Arrastras hacia la izquierda:
               acompaña hacia la izquierda.
        */

        targetYaw +=
            dx *
            CAMERA_SENSITIVITY;


        /*
           ====================================================
           MOVIMIENTO VERTICAL
           ====================================================

           Esta dirección está puesta para que el movimiento
           se sienta como "agarrar" el puzzle.

           Mouse arriba -> puzzle acompaña hacia arriba.
           Mouse abajo  -> puzzle acompaña hacia abajo.
        */

        targetPitch +=
            dy *
            CAMERA_SENSITIVITY;


        /*
           Evitamos dar vuelta completamente la cámara.
        */

        targetPitch =
            clamp(
                targetPitch,
                -1.38,
                1.38
            );


        previousPointerX =
            event.clientX;

        previousPointerY =
            event.clientY;


        event.preventDefault();
    }
);


/* ============================================================
   TERMINAR ARRASTRE
   ============================================================ */

function stopCameraDrag(
    event
) {

    if (
        event &&
        activePointerId !== null &&
        event.pointerId !==
        activePointerId
    ) {
        return;
    }


    draggingCamera = false;

    activePointerId = null;

    canvas.style.cursor =
        "grab";
}


canvas.addEventListener(
    "pointerup",
    stopCameraDrag
);


canvas.addEventListener(
    "pointercancel",
    stopCameraDrag
);


canvas.addEventListener(
    "lostpointercapture",
    () => {

        draggingCamera = false;

        activePointerId = null;

        canvas.style.cursor =
            "grab";
    }
);


/* ============================================================
   ZOOM CON RUEDA
   ============================================================ */

canvas.addEventListener(
    "wheel",
    event => {

        event.preventDefault();


        /*
           Limitamos deltaY para que una rueda muy sensible
           no mande el puzzle al infinito.
        */

        const wheel =
            clamp(
                event.deltaY,
                -120,
                120
            );


        targetDistance +=
            wheel *
            0.008;


        targetDistance =
            clamp(
                targetDistance,
                4.5,
                11.0
            );
    },

    {
        passive: false
    }
);


/* ============================================================
   DOBLE CLIC = CENTRAR
   ============================================================ */

canvas.addEventListener(
    "dblclick",
    event => {

        event.preventDefault();

        resetCamera();

        setStatus(
            "🎯 Cámara centrada"
        );
    }
);


/* ============================================================
   TECLADO
   ============================================================ */

window.addEventListener(
    "keydown",
    event => {

        /*
           No robamos teclas si el usuario está escribiendo
           en algún input.
        */

        const target =
            event.target;


        if (
            target &&
            (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT"
            )
        ) {

            return;
        }


        const key =
            event.key.toUpperCase();


        /* ====================================================
           U D L R F B
           ==================================================== */

        if (
            [
                "U",
                "D",
                "L",
                "R",
                "F",
                "B"
            ].includes(key)
        ) {

            event.preventDefault();


            const notation =

                key +

                (
                    event.shiftKey
                        ? "'"
                        : ""
                );


            performMove(
                notation
            );

            return;
        }


        /* ====================================================
           0 = CENTRAR CÁMARA
           ==================================================== */

        if (
            event.key === "0"
        ) {

            event.preventDefault();

            resetCamera();

            setStatus(
                "🎯 Cámara centrada"
            );
        }
    }
);


/* ============================================================
   RESIZE DEL CANVAS
   ============================================================ */

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();


    /*
       Limitamos DPR a 2.

       En pantallas 4K/Retina evita renderizar una cantidad
       absurda de píxeles sin una mejora visual importante.
    */

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );


    const width =
        Math.max(
            1,
            Math.round(
                rect.width *
                dpr
            )
        );


    const height =
        Math.max(
            1,
            Math.round(
                rect.height *
                dpr
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


/* ============================================================
   MATRIZ DE CÁMARA
   ============================================================ */

function buildCameraMatrix() {

    const aspect =

        canvas.width /

        Math.max(
            canvas.height,
            1
        );


    const projection =
        mat4Perspective(

            PI / 5,

            aspect,

            0.1,

            100
        );


    /*
       Rotación vertical.
    */

    const rotationX =
        mat4RotationX(
            cameraPitch
        );


    /*
       Rotación horizontal.
    */

    const rotationY =
        mat4RotationY(
            cameraYaw
        );


    /*
       Combinamos ambas.
    */

    const rotation =
        mat4Multiply(
            rotationX,
            rotationY
        );


    /*
       Alejamos el puzzle de la cámara.
    */

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


/* ============================================================
   SUAVIZADO DE CÁMARA
   ============================================================ */

function updateCamera() {

    /*
       La cámara no salta directamente al objetivo.

       Se acerca progresivamente.

       Esto hace que el mouse se sienta bastante más suave.
    */

    cameraYaw =
        lerp(
            cameraYaw,
            targetYaw,
            0.24
        );


    cameraPitch =
        lerp(
            cameraPitch,
            targetPitch,
            0.24
        );


    cameraDistance =
        lerp(
            cameraDistance,
            targetDistance,
            0.18
        );
}


/* ============================================================
   CONFIGURACIÓN DE ATRIBUTOS WEBGL
   ============================================================ */

function bindAttributes() {

    /* ========================================================
       POSICIONES
       ======================================================== */

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


    /* ========================================================
       NORMALES
       ======================================================== */

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


    /* ========================================================
       COLORES
       ======================================================== */

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


    /* ========================================================
       MATERIAL
       ======================================================== */

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        materialBuffer
    );


    gl.enableVertexAttribArray(
        aMaterial
    );


    gl.vertexAttribPointer(
        aMaterial,

        1,

        gl.FLOAT,

        false,

        0,

        0
    );
}


/* ============================================================
   RENDER
   ============================================================ */

function renderMirror() {

    resizeCanvas();


    /* ========================================================
       DEPTH TEST
       ======================================================== */

    gl.enable(
        gl.DEPTH_TEST
    );


    gl.depthFunc(
        gl.LEQUAL
    );


    /*
       No usamos transparencia.

       Esto corrige uno de los problemas de la versión vieja,
       donde algunas piezas daban la sensación de ser
       transparentes o desaparecer.
    */

    gl.disable(
        gl.BLEND
    );


    /*
       Dejamos CULL_FACE apagado.

       Cuando el Mirror está mezclado pueden quedar visibles
       caras interiores negras.
    */

    gl.disable(
        gl.CULL_FACE
    );


    /* ========================================================
       FONDO
       ======================================================== */

    gl.clearColor(
        0.008,
        0.010,
        0.015,
        1.0
    );


    gl.clear(
        gl.COLOR_BUFFER_BIT |
        gl.DEPTH_BUFFER_BIT
    );


    gl.useProgram(
        program
    );


    /* ========================================================
       MATRIZ
       ======================================================== */

    const matrix =
        buildCameraMatrix();


    gl.uniformMatrix4fv(
        uMatrix,
        false,
        matrix
    );


    /* ========================================================
       BUFFERS
       ======================================================== */

    bindAttributes();


    /* ========================================================
       DIBUJAR
       ======================================================== */

    gl.drawArrays(
        gl.TRIANGLES,
        0,
        vertexCount
    );
}


/* ============================================================
   LOOP PRINCIPAL
   ============================================================ */

function frame(now) {

    /*
       Cámara independiente.

       Aunque el puzzle esté girando, mezclándose o
       resolviéndose, esto continúa funcionando.
    */

    updateCamera();


    /*
       Actualizamos el movimiento actual.
    */

    animateActiveMove(
        now
    );


    /*
       Si terminó, iniciamos el siguiente movimiento
       de la cola.
    */

    processMoveQueue();


    /*
       Dibujamos.
    */

    renderMirror();


    requestAnimationFrame(
        frame
    );
}


/* ============================================================
   DEBUG — ESTADO ACTUAL
   ============================================================ */

function getMirrorState() {

    return {

        pieces:
            pieces.length,

        activeMove:

            activeMove
                ? activeMove.notation
                : null,

        queue:
            moveQueue.length,

        history:
            [...moveHistory],

        moveCounter,

        camera: {

            yaw:
                cameraYaw,

            pitch:
                cameraPitch,

            distance:
                cameraDistance
        }
    };
}


/* ============================================================
   DEBUG — INFORMACIÓN DE PIEZAS
   ============================================================ */

function getPiecesDebug() {

    return pieces.map(
        piece => ({

            id:
                piece.id,

            logical:
                copy3(
                    piece.logical
                ),

            homeLogical:
                copy3(
                    piece.homeLogical
                ),

            center:
                copy3(
                    piece.center
                ),

            size:
                copy3(
                    piece.size
                ),

            basisX:
                copy3(
                    piece.basisX
                ),

            basisY:
                copy3(
                    piece.basisY
                ),

            basisZ:
                copy3(
                    piece.basisZ
                ),

            exposed: {
                ...piece.exposed
            }
        })
    );
}


/* ============================================================
   API PÚBLICA
   ============================================================ */

/*
   Desde la consola podrás usar:

       easyRubikMirror.move("R")

       easyRubikMirror.move("R'")

       easyRubikMirror.scramble()

       easyRubikMirror.solve()

       easyRubikMirror.reset()

       easyRubikMirror.camera()

       easyRubikMirror.state()

       easyRubikMirror.pieces()

       easyRubikMirror.testMove("R")
*/

window.easyRubikMirror = {

    move:
        performMove,


    scramble:
        scrambleMirror,


    solve:
        solveMirror,


    reset() {

        resetMirrorState();

        resetCamera();
    },


    camera:
        resetCamera,


    state:
        getMirrorState,


    pieces:
        getPiecesDebug,


    testMove:
        testMoveAndInverse
};


/* ============================================================
   ARRANQUE
   ============================================================ */

/*
   1. Creamos las 26 piezas.
*/

buildMirror();


/*
   2. Validamos que cada capa tenga nueve piezas.
*/

validateMirror();


/*
   3. Generamos la geometría inicial.
*/

rebuildGeometry();


/*
   4. Reiniciamos contador.
*/

updateMoveCounter();


/*
   5. Estado inicial.
*/

setStatus(
    "🪞 Mirror Cube listo"
);


/* ============================================================
   INFORMACIÓN EN CONSOLA
   ============================================================ */

console.log(
    "========================================"
);


console.log(
    "🪞 easyRubik — MIRROR CUBE"
);


console.log(
    "Piezas visibles:",
    pieces.length
);


console.log(
    "Movimientos:"
);


console.log(
    "U U' D D' L L' R R' F F' B B'"
);


console.log(
    "Teclado:"
);


console.log(
    "U D L R F B"
);


console.log(
    "Shift + tecla = movimiento inverso"
);


console.log(
    "Mouse:"
);


console.log(
    "Arrastrar = mover cámara"
);


console.log(
    "Rueda = zoom"
);


console.log(
    "Doble clic = centrar cámara"
);


console.log(
    "0 = centrar cámara"
);


console.log(
    "La cámara permanece activa durante scramble/solve."
);


console.log(
    "API:"
);


console.log(
    "window.easyRubikMirror"
);


console.log(
    "========================================"
);


/* ============================================================
   INICIAR LOOP
   ============================================================ */

requestAnimationFrame(
    frame
);


/* ============================================================
   FIN easyRubik MIRROR
   ============================================================ */

})();
