import { RoundedBox, useGLTF, useTexture } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { assetUrl, type Scene } from './stores/configuratorStore';

/*
 * Sfeerobjecten onder de lamp, op ware grootte in meters: eettafel met stoelen, bank met salontafel, of een trap in een vide.
 * Eenvoudige vormen in rustige kleuren, zodat de lamp het onderwerp blijft. Ze horen niet bij de bestelling.
 */

const OAK = new THREE.MeshStandardMaterial({ color: '#b08b62', roughness: 0.6 });
const STEEL = new THREE.MeshStandardMaterial({ color: '#1c1c1c', metalness: 0.6, roughness: 0.45 });
const FABRIC = new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.95 });
const SOFA = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 0.95 });
const SOFA_BACK = new THREE.MeshStandardMaterial({ color: '#958e83', roughness: 0.95 });
const STONE = new THREE.MeshStandardMaterial({ color: '#b9ab93', roughness: 0.35 });
const RUG = new THREE.MeshStandardMaterial({ color: '#a89c88', roughness: 1 });
const WALL = new THREE.MeshStandardMaterial({ color: '#efeae2', roughness: 1 });
const GLASS = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.9, roughness: 0.05, thickness: 0.01, transparent: true, opacity: 0.35 });

type Vec3 = [number, number, number];

function Box({ size, position, material, rotation }: { size: Vec3; position: Vec3; material: THREE.Material; rotation?: Vec3 }) {
    return (
        <mesh position={position} rotation={rotation} material={material} castShadow receiveShadow>
            <boxGeometry args={size} />
        </mesh>
    );
}

/** Hoogte van de vloer onder de onderste lamp: 70 cm boven de eettafel, 160 cm boven de salontafelhoek, 2,2 m vrij in een vide. */
export function floorFor(scene: Scene, lowest: number): number {
    if (scene === 'dining') return lowest - 0.7 - 0.75;
    if (scene === 'coffee') return lowest - 1.6;
    if (scene === 'stairs') return lowest - 2.2;
    return lowest - 0.9;
}

const SHELL = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.45, side: THREE.DoubleSide });
const LIGHT_OAK = new THREE.MeshStandardMaterial({ color: '#c9a77c', roughness: 0.55 });

/** Ronde staaf tussen twee punten: stoelpoten en draadframe. */
function Rod({ from, to, radius, material }: { from: Vec3; to: Vec3; radius: number; material: THREE.Material }) {
    const { position, quaternion, length } = useMemo(() => {
        const a = new THREE.Vector3(...from);
        const b = new THREE.Vector3(...to);
        const direction = b.clone().sub(a);
        return {
            position: a.add(b).multiplyScalar(0.5),
            quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
            length: direction.length(),
        };
    }, [from, to]);
    return (
        <mesh position={position} quaternion={quaternion} material={material} castShadow>
            <cylinderGeometry args={[radius, radius, length, 10]} />
        </mesh>
    );
}

/**
 * Kuipzitting van een moderne kuipstoel, zelf opgebouwd: een profiel van voorrand via zitting omhoog naar de rugleuning,
 * over de breedte gebogen (zijkanten van de zitting iets omhoog, rugleuning om de rug heen).
 */
const shellGeometry = (() => {
    const profile = new THREE.CatmullRomCurve3(
        [[0.23, 0.41], [0.2, 0.445], [0.05, 0.45], [-0.12, 0.46], [-0.21, 0.53], [-0.25, 0.66], [-0.26, 0.8]].map(([z, y]) => new THREE.Vector3(0, y, z)),
    );
    const rows = 40;
    const columns = 24;
    const positions: number[] = [];
    for (let i = 0; i <= rows; i++) {
        const s = i / rows;
        const point = profile.getPoint(s);
        const back = THREE.MathUtils.smoothstep(s, 0.45, 0.75); // 0 = zitting, 1 = rugleuning
        const half = THREE.MathUtils.lerp(0.235, 0.25, back) * (s < 0.08 ? 0.92 + s : 1);
        for (let j = 0; j <= columns; j++) {
            const t = (j / columns) * 2 - 1;
            positions.push(t * half, point.y + (1 - back) * 0.05 * t ** 4, point.z + back * 0.07 * t ** 2);
        }
    }
    const indices: number[] = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < columns; j++) {
            const a = i * (columns + 1) + j;
            const b = a + columns + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
})();

/** Moderne kuipstoel: witte kuip op vier licht uitlopende eiken poten met een zwart draadframe. */
function Chair({ x, z, facing }: { x: number; z: number; facing: number }) {
    const legs: [Vec3, Vec3][] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [[sx * 0.15, 0.42, sz * 0.13], [sx * 0.23, 0, sz * 0.22]] as [Vec3, Vec3]));
    // Punt op een poot op hoogte y.
    const along = ([top, bottom]: [Vec3, Vec3], y: number): Vec3 => {
        const f = (top[1] - y) / top[1];
        return [top[0] + (bottom[0] - top[0]) * f, y, top[2] + (bottom[2] - top[2]) * f];
    };
    return (
        <group position={[x, 0, z]} rotation={[0, facing, 0]}>
            <mesh geometry={shellGeometry} material={SHELL} castShadow receiveShadow />
            {legs.map(([top, bottom], i) => (
                <Rod key={i} from={top} to={bottom} radius={0.014} material={LIGHT_OAK} />
            ))}
            {/* Draadframe: zijstangen en een kruis tussen de poten */}
            <Rod from={along(legs[0], 0.2)} to={along(legs[1], 0.2)} radius={0.004} material={STEEL} />
            <Rod from={along(legs[2], 0.2)} to={along(legs[3], 0.2)} radius={0.004} material={STEEL} />
            <Rod from={along(legs[0], 0.2)} to={along(legs[3], 0.2)} radius={0.004} material={STEEL} />
            <Rod from={along(legs[1], 0.2)} to={along(legs[2], 0.2)} radius={0.004} material={STEEL} />
        </group>
    );
}

/**
 * Moderne zespersoons eettafel van 2 m: dun licht eiken blad op een slank zwart stalen onderstel, drie kuipstoelen
 * aan elke lange kant. Zelf getekend, zonder decoratie op tafel.
 */
function DiningSet() {
    const length = 2;
    const chairs = 3;
    const depth = 0.95;
    return (
        <group>
            <Box size={[length, 0.03, depth]} position={[0, 0.735, 0]} material={LIGHT_OAK} />
            {/* Onderstel: smalle zwarte regels onder het blad en vier slanke vierkante poten, iets ingesprongen */}
            {[-1, 1].map((side) => (
                <group key={side}>
                    <Box size={[length - 0.3, 0.06, 0.025]} position={[0, 0.69, side * (depth / 2 - 0.12)]} material={STEEL} />
                    <Box size={[0.025, 0.06, depth - 0.24]} position={[side * (length / 2 - 0.15), 0.69, 0]} material={STEEL} />
                    {[-1, 1].map((end) => (
                        <Box key={end} size={[0.04, 0.72, 0.04]} position={[side * (length / 2 - 0.15), 0.36, end * (depth / 2 - 0.12)]} material={STEEL} />
                    ))}
                </group>
            ))}
            {Array.from({ length: chairs }, (_, i) => {
                const x = -length / 2 + (length / chairs) * (i + 0.5);
                return (
                    <group key={i}>
                        <Chair x={x} z={-0.62} facing={0} />
                        <Chair x={x} z={0.62} facing={Math.PI} />
                    </group>
                );
            })}
        </group>
    );
}

/** Zacht afgerond blok voor bankkussens en armleuningen. */
function Cushion({ size, position, material }: { size: Vec3; position: Vec3; material: THREE.Material }) {
    return <RoundedBox args={size} radius={Math.min(0.06, Math.min(...size) / 2 - 0.005)} smoothness={3} position={position} material={material} castShadow receiveShadow />;
}

/**
 * Moderne, lage driezitsbank van 2,4 m, zelf getekend: afgeronde zit- en rugkussens op dunne zwarte pootjes.
 * Zithoogte 44 cm, rug tot 81 cm.
 */
function Sofa() {
    const width = 2.4;
    const depth = 0.95;
    return (
        <group>
            {/* Onderbak en armleuningen */}
            <Cushion size={[width, 0.22, depth]} position={[0, 0.19, 0]} material={SOFA} />
            {[-1, 1].map((side) => (
                <Cushion key={side} size={[0.2, 0.5, depth]} position={[side * (width / 2 - 0.1), 0.33, 0]} material={SOFA} />
            ))}
            {/* Drie zitkussens en drie rugkussens */}
            {[-1, 0, 1].map((i) => (
                <group key={i}>
                    <Cushion size={[0.66, 0.14, 0.72]} position={[i * 0.67, 0.37, 0.08]} material={SOFA} />
                    <Cushion size={[0.66, 0.42, 0.2]} position={[i * 0.67, 0.6, -0.34]} material={SOFA_BACK} />
                </group>
            ))}
            {/* Dunne zwarte pootjes */}
            {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
                <Box key={`${sx}${sz}`} size={[0.03, 0.08, 0.03]} position={[sx * (width / 2 - 0.08), 0.04, sz * (depth / 2 - 0.08)]} material={STEEL} />
            )))}
        </group>
    );
}

/**
 * Ronde salontafel met marmeren blad en verchroomd onderstel: "Coffee Table Round 01" door Ulan Cabanilla (Poly Haven, CC0:
 * vrij te gebruiken, ook commercieel, zonder naamsvermelding). Omgezet met tools/3d/blender_coffee_table.py naar
 * public/models/coffee-table.glb, met de eigen texturen. Het origineel is 1,30 m breed; hier op 90 cm (hoogte 34 cm).
 */
function CoffeeTable() {
    const { scene } = useGLTF(assetUrl('/models/coffee-table.glb'));
    const model = useMemo(() => {
        const copy = scene.clone(true);
        copy.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
        });
        return copy;
    }, [scene]);
    return <primitive object={model} scale={0.9 / 1.3} />;
}

/** Moderne bank achter een ronde marmeren salontafel, op een kleed. Zonder decoratie. */
function CoffeeCorner() {
    return (
        <group>
            <mesh position={[0, 0.005, -0.3]} rotation-x={-Math.PI / 2} material={RUG} receiveShadow>
                <planeGeometry args={[3, 2.2]} />
            </mesh>
            {/* Tijdens het laden (1,5 MB) een eenvoudige ronde tafel. */}
            <Suspense
                fallback={
                    <mesh position={[0, 0.17, 0]} material={STONE} castShadow receiveShadow>
                        <cylinderGeometry args={[0.45, 0.45, 0.34, 48]} />
                    </mesh>
                }
            >
                <CoffeeTable />
            </Suspense>
            {/* Bank achter de salontafel, met de zitting naar de camera */}
            <group position={[0, 0, -1.25]}>
                <Sofa />
            </group>
        </group>
    );
}

/**
 * Wenteltrap met open trapgat rond de lamp, zelf getekend (geen model van derden): de pendel hangt in het midden van de trap.
 * Eiken treden tussen twee gebogen stalen trapbomen, spijlen en een leuning langs het trapgat. Het gat groeit mee met de lamp;
 * de draai volgt uit een normale aantrede (± 27 cm op de looplijn) en is hoogstens 330°. Bovenaan komt de trap uit op de
 * verdiepingsvloer achter de lamp.
 */
export function spiralSize(width: number) {
    const inner = Math.max(0.5, width / 2 + 0.25); // vrije ruimte rond de lamp
    return { inner, outer: inner + 0.9 }; // traptreden van 90 cm breed
}

function SpiralStaircase({ ceiling, width }: { ceiling: number; width: number }) {
    // Eén doorlopende wenteltrap tot net onder het plafond; bij een lange pendel (6 m) draait hij dus meerdere keren rond.
    const height = ceiling - 0.6;
    const steps = Math.round(height / 0.19);
    const rise = height / steps;
    const { inner, outer } = spiralSize(width);
    const walkline = (inner + outer) / 2;
    const angleStep = 0.27 / walkline; // aantrede ± 27 cm op de looplijn
    const turn = angleStep * steps;
    // De bovenste trede wijst naar achteren (-z), naar de bovenste verdiepingsvloer.
    const angle = (i: number) => Math.PI / 2 - turn + angleStep * (i + 1);
    // Verdiepingen van ± 2,9 m: alleen als dunne, lichte vloerrand achter het trapgat, zodat het rustig blijft.
    const levels = Math.max(1, Math.round(height / 2.9));

    const tread = useMemo(() => {
        const half = (angleStep * 1.04) / 2;
        const shape = new THREE.Shape();
        shape.absarc(0, 0, outer, -half, half, false);
        shape.absarc(0, 0, inner, half, -half, true);
        return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2);
    }, [angleStep, inner, outer]);

    // Gebogen buis langs de hele trap op straal r, hoogte boven de treden dy.
    const helix = (r: number, dy: number, thickness: number) => {
        const points = Array.from({ length: steps * 4 + 1 }, (_, k) => {
            const i = k / 4 - 0.5;
            const a = angle(i);
            return new THREE.Vector3(Math.cos(a) * r, rise * (i + 1) + dy, -Math.sin(a) * r);
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 8, thickness, 8, false);
    };
    const geometries = useMemo(
        () => ({ innerStringer: helix(inner, -0.12, 0.03), outerStringer: helix(outer, -0.12, 0.03), rail: helix(inner + 0.04, 0.9, 0.018) }),
        [steps, rise, inner, outer, angleStep], // eslint-disable-line react-hooks/exhaustive-deps
    );

    return (
        <group>
            {Array.from({ length: steps }, (_, i) => (
                <group key={i} rotation={[0, angle(i), 0]}>
                    <mesh geometry={tread} material={OAK} position={[0, rise * (i + 1) - 0.04, 0]} castShadow receiveShadow />
                    {/* Spijl langs het trapgat, om de trede: rustiger dan een spijl op elke trede */}
                    {i % 2 === 0 && (
                        <mesh position={[inner + 0.04, rise * (i + 1) + 0.45, 0]} material={STEEL}>
                            <cylinderGeometry args={[0.007, 0.007, 0.9, 6]} />
                        </mesh>
                    )}
                </group>
            ))}
            <mesh geometry={geometries.innerStringer} material={STEEL} castShadow />
            <mesh geometry={geometries.outerStringer} material={STEEL} castShadow />
            <mesh geometry={geometries.rail} material={STEEL} />

            {/* Verdiepingsvloeren: dunne lichte randen achter het trapgat, in de kleur van de wand */}
            {Array.from({ length: levels }, (_, level) => {
                const y = ((level + 1) / levels) * height;
                const top = level === levels - 1;
                return (
                    <group key={level}>
                        <Box size={[8, 0.15, 2.2]} position={[0, y - 0.075, -outer - 1.1]} material={WALL} />
                        {/* Alleen op de bovenste verdieping een glazen balustrade langs de vide */}
                        {top && <Box size={[3.4, 1, 0.012]} position={[-outer - 0.3, y + 0.5, -outer]} material={GLASS} />}
                    </group>
                );
            })}
            {/* Achterwand van de vide */}
            <Box size={[10, ceiling, 0.1]} position={[0, ceiling / 2, -outer - 2.2]} material={WALL} />
        </group>
    );
}

/**
 * Silhouet van een staande vrouw van 1,68 m in broekpak (lifestyle/women2.png, uitgesneden uit women2.jpg, strak van kruin tot voeten),
 * als maatstok naast de lamp: een plat vlak met de afbeelding, de transparante delen weggesneden.
 */
function Person({ x, z }: { x: number; z: number }) {
    const texture = useTexture(assetUrl('/images/configurator/lifestyle/women2.png'));
    const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, color: '#000000', transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), [texture]);
    const height = 1.68;
    return (
        <mesh material={material} position={[x, height / 2, z]} rotation={[0, 0.25, 0]} castShadow>
            {/* Breedte volgt de verhouding van de afbeelding (378 x 1604 px). */}
            <planeGeometry args={[height * (378 / 1604), height]} />
        </mesh>
    );
}

/** Vloer en sfeerobjecten; floor is de hoogte van de vloer (negatief, onder het plafond op 0). */
export default function Furniture({ scene, floor, width, person }: { scene: Scene; floor: number; width: number; person: boolean }) {
    if (scene === 'none' && !person) return null;
    return (
        <group position={[0, floor, 0]}>
            <mesh rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[14, 14]} />
                <meshStandardMaterial color="#d6c7b0" roughness={0.8} />
            </mesh>
            {scene === 'dining' && <DiningSet />}
            {scene === 'coffee' && <CoffeeCorner />}
            {scene === 'stairs' && <SpiralStaircase ceiling={-floor} width={width} />}
            {person && (
                <Suspense fallback={null}>
                    {/* Bij de trap vóór de trap, anders naast de lamp. */}
                    {scene === 'stairs' ? <Person x={-(spiralSize(width).outer + 0.5)} z={0.9} /> : <Person x={-(width / 2 + 0.9)} z={0.5} />}
                </Suspense>
            )}
        </group>
    );
}
