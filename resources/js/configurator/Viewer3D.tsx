import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import Furniture, { floorFor } from './Furniture';
import { anchors, drops } from './layout';
import { assetUrl, glassPerPosition, isStandalone, option, setViewerCanvas, useConfigurator } from './stores/configuratorStore';
import { BASE_COLORS } from './baseColors';
import type { BaseColor, Option } from './types';

/*
 * 3D-weergave: Tulip gebruikt het echte Maretti-model (public/models), de andere vormen zijn nog benaderingen op de maten uit de catalogus.
 * Zodra er van een familie 3D-bestanden zijn, komen die er op dezelfde manier bij (zie modelFor).
 */

const BLACK = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.55, metalness: 0.3 });
const GOLD = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.3, metalness: 1, side: THREE.BackSide });

const MATERIALS: Record<string, () => THREE.Material> = {
    koper: () => new THREE.MeshPhysicalMaterial({ color: '#b87333', metalness: 0.85, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide }),
    smoke: () => glassTint('#4a4a50'),
    cognac: () => glassTint('#b8742a'),
    helder: () => glassTint('#d8d8da'),
    mat: () => new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', transmission: 0.6, roughness: 0.65, thickness: 0.3, side: THREE.DoubleSide }),
    brons: () => new THREE.MeshPhysicalMaterial({ color: '#e8dcc4', transmission: 0.9, roughness: 0.15, thickness: 0.6, ior: 1.6 }),
    chroom: () => new THREE.MeshPhysicalMaterial({ color: '#eef2f5', transmission: 0.9, roughness: 0.1, thickness: 0.6, ior: 1.6 }),
    'zwart-goud': () => BLACK,
    amber: () => glassTint('#c8861e'),
    goud: () => new THREE.MeshPhysicalMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide }),
    gunmetal: () => new THREE.MeshStandardMaterial({ color: '#3d3f42', metalness: 0.9, roughness: 0.35 }),
    albast: () => new THREE.MeshPhysicalMaterial({ color: '#f1ebe0', transmission: 0.45, roughness: 0.8, thickness: 0.4, side: THREE.DoubleSide }),
    rood: () => glassTint('#a3242b'),
    bruin: () => glassTint('#5e3a22'),
    blauw: () => glassTint('#2c4f7c'),
    wit: () => new THREE.MeshPhysicalMaterial({ color: '#f7f4ee', transmission: 0.35, roughness: 0.9, thickness: 0.2, side: THREE.DoubleSide }),
    'smoke-zwart': () => glassTint('#4a4a50'),
    'smoke-messing': () => glassTint('#4a4a50'),
    'opaal-zwart': () => new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', transmission: 0.5, roughness: 0.7, thickness: 0.3, side: THREE.DoubleSide }),
    'opaal-messing': () => new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', transmission: 0.5, roughness: 0.7, thickness: 0.3, side: THREE.DoubleSide }),
};

/** Metaalachtige afwerkingen; de rest is glas of stof. */
const METALLIC = new Set(['koper', 'goud', 'brons', 'messing', 'gunmetal', 'rosegoud']);
/** Matte of melkachtige glazen en stoffen kappen laten weinig licht door en zijn niet glanzend. */
const MATTE = new Set(['mat', 'wit', 'albast', 'opaal-zwart', 'opaal-messing']);

/**
 * Materiaal in de kleur van de productfoto (meta.tint, gemeten door de seeder).
 * Het glas is minder doorzichtig dan echt glas, zodat de kleur op het lichte decor gelijk blijft aan de foto.
 */
function materialFor(meta: Record<string, any>): THREE.Material {
    const { tint } = meta as { tint?: string | null };
    // Bij een uitvoering zonder kleurkeuze (Hortense: aantal lichten) staat de afwerking apart.
    const color: string = meta.finish ?? meta.color;

    // Zwarte buizen en kappen: op de foto kleurt de brandende lamp mee, dus vast mat zwart.
    if (color.startsWith('zwart')) return BLACK;
    if (!tint) return (MATERIALS[color] ?? MATERIALS.helder)();
    // Metaal oogt in 3D donkerder dan op de foto (het decor is vrij leeg om te weerspiegelen), daarom iets lichter.
    if (METALLIC.has(color)) {
        const bright = new THREE.Color(tint).multiplyScalar(1.5);
        return new THREE.MeshPhysicalMaterial({ color: bright, metalness: 0.55, roughness: 0.25, clearcoat: 1, side: THREE.DoubleSide });
    }

    if (MATTE.has(color)) {
        return new THREE.MeshPhysicalMaterial({ color: tint, transmission: 0.15, roughness: 0.7, thickness: 0.5, ior: 1.5, side: THREE.DoubleSide });
    }
    return glassTint(tint);
}

/**
 * Helder en gekleurd glas: half doorzichtig met sterke reflecties. Met transmission viel het glas weg tegen het lichte decor
 * (en bleef het op sommige videokaarten hangen); zo blijven vorm, kleur en het lampje erin zichtbaar. Licht glas iets doorzichtiger.
 */
function glassTint(color: string): THREE.Material {
    const { l } = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 });
    return new THREE.MeshPhysicalMaterial({
        color,
        transparent: true,
        opacity: l > 0.7 ? 0.35 : 0.7,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2.5,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
}

/** Profielen (straal, hoogte) genormaliseerd op 0..1, gedraaid tot een rond glas. */
const PROFILES: Record<string, [number, number][]> = {
    tulip: [[0.55, 0], [0.85, 0.12], [1, 0.35], [0.95, 0.6], [0.6, 0.85], [0.15, 0.97], [0.08, 1]],
    duchess: [[0.9, 0], [1, 0.15], [0.95, 0.5], [0.7, 0.8], [0.25, 0.95], [0.1, 1]],
    icosa: [[0.02, 0], [1, 0.45], [0.45, 0.9], [0.12, 1]],
    icon: [[1, 0], [1, 1]],
    barca: [[1, 0], [1, 1]],
    sliced: [[1, 0], [0.95, 0.05], [0.45, 0.45], [0.2, 0.75], [0.08, 1]],
    tommy: [[1, 0], [1, 0.7], [0.85, 1], [0.1, 1]],
};

function profileGeometry(shape: string): THREE.BufferGeometry {
    if (shape === 'inciso') return new THREE.SphereGeometry(1, 48, 32).translate(0, 1, 0).scale(1, 0.5, 1);
    if (shape === 'jewel') return new THREE.DodecahedronGeometry(1, 0).translate(0, 1, 0).scale(1, 0.5, 1);
    const points = (PROFILES[shape] ?? PROFILES.tulip).map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(points, shape === 'icosa' ? 6 : 48);
}

function Rod({ from, to, radius = 0.003, material = BLACK }: { from: THREE.Vector3; to: THREE.Vector3; radius?: number; material?: THREE.Material }) {
    const { position, quaternion, length } = useMemo(() => {
        const direction = new THREE.Vector3().subVectors(to, from);
        return {
            length: direction.length(),
            position: new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
            quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
        };
    }, [from, to]);

    return (
        <mesh position={position} quaternion={quaternion} material={material} castShadow>
            <cylinderGeometry args={[radius, radius, length, 8]} />
        </mesh>
    );
}

/**
 * Echte Maretti-modellen in public/models, gemaakt uit de SketchUp-scènes in mixenmatch/3D (één lamp per maat, ware grootte in meters,
 * onderkant-midden op de oorsprong). Elke GLB heeft meshes per rol: glass, metal, holder, gold, light.
 * Inciso en Cristallo (productfoto's), Icosa S/M/L, Zen, Ozone, Johnnie en Felice (maattekeningen) zijn zelf opgebouwd met tools/3d/<naam>.py.
 * Lampen zonder model blijven een benadering op de maten uit de catalogus.
 */
function modelFor(glass: Option): string | null {
    const { key } = glass;
    const { shape, diameter } = glass.meta as { shape: string; diameter: number };
    if (shape === 'tulip' && key.startsWith('tulip')) return `tulip-${diameter <= 250 ? 's' : diameter <= 350 ? 'm' : 'l'}`;
    if (key.startsWith('icon')) return 'icon';
    if (key.startsWith('jewel-')) return key.startsWith('jewel-s') ? 'jewel-s' : 'jewel-l';
    if (key.startsWith('paradiso-')) return diameter <= 200 ? 'paradiso-170' : 'paradiso-250';
    if (key.startsWith('soffio')) return 'soffio';
    if (/^tommy-\d+$/.test(key)) return key;
    if (/^sliced-[SML]$/.test(key)) return `sliced-${key.slice(-1).toLowerCase()}`;
    if (key.startsWith('bo-')) return 'bo';
    if (/^hortense-[1357]$/.test(key)) return key;
    if (key.startsWith('inciso-')) return 'inciso';
    if (key.startsWith('cristallo-')) return 'cristallo';
    if (/^zen-(350|440|480)$/.test(key)) return key;
    if (key.startsWith('ozone-')) return 'ozone';
    if (key.startsWith('johnnie-')) return 'johnnie';
    if (key.startsWith('felice-')) return 'felice';
    // Icosa in 230V Small (icosa-smoke) is de S.
    if (key.startsWith('icosa-')) return `icosa-${(/^icosa-([SML])-/.exec(key)?.[1] ?? 'S').toLowerCase()}`;
    return null;
}

const metal = (color: string, roughness = 0.3) => new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness });
const FINISHES: Record<string, THREE.Material> = {
    brons: metal('#8c6a3f', 0.35),
    messing: metal('#c9a961', 0.25),
    chroom: metal('#e4e8eb', 0.08),
    gunmetal: metal('#3d3f42', 0.35),
    goud: metal('#d4af37', 0.2),
    rosegoud: metal('#b07e6a', 0.25),
};
const GOLD_INSIDE = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.25, side: THREE.DoubleSide });
const LIGHT = new THREE.MeshStandardMaterial({ color: '#ffe3b8', emissive: '#ffb35c', emissiveIntensity: 2.5, toneMapped: false });
const CRYSTAL = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.9, roughness: 0.05, thickness: 0.6, ior: 1.6, side: THREE.DoubleSide });

/** Materiaal per onderdeel van het model, afgeleid van de gekozen uitvoering. */
function materialsFor(glass: Option, model: string): Record<string, THREE.Material> {
    const color: string = glass.meta.color;
    const holder =
        FINISHES[glass.meta.finish] ?? // Hortense: altijd brons
        FINISHES[color] ?? // Glass Jewel brons/chroom, Bo brons/gunmetal, Venetian brons, Felice rosé goud
        (color.endsWith('messing') ? FINISHES.messing : model === 'soffio' ? FINISHES.gunmetal : BLACK);
    let glassMaterial = materialFor(glass.meta);
    if (model.startsWith('jewel')) glassMaterial = CRYSTAL;
    // Felice: de kleur hoort bij de ring, het glas is altijd helder.
    if (model === 'felice') glassMaterial = glassTint('#eef1f3');
    if (model.startsWith('paradiso')) glassMaterial = color.startsWith('opaal') ? (MATERIALS['opaal-zwart'] ?? MATERIALS.mat)() : glassTint('#4a4a50');
    return { glass: glassMaterial, metal: BLACK, holder, gold: GOLD_INSIDE, light: LIGHT };
}

function useModel(name: string): { parts: { role: string; geometry: THREE.BufferGeometry }[]; height: number } {
    const { scene } = useGLTF(assetUrl(`/models/${name}.glb`));
    return useMemo(() => {
        const parts: { role: string; geometry: THREE.BufferGeometry }[] = [];
        scene.updateMatrixWorld(true);
        scene.traverse((child) => {
            if (!(child as THREE.Mesh).isMesh) return;
            // Normalen per facet opnieuw berekenen: geeft geslepen glas zijn facetten en voorkomt zwarte vlakken.
            const geometry = (child as THREE.Mesh).geometry.toNonIndexed().applyMatrix4(child.matrixWorld);
            geometry.computeVertexNormals();
            // De rol staat in de naam van de node of het mesh (glass, metal, holder, gold, light).
            const role = [child.name, child.parent?.name ?? ''].map((n) => n.split(/[._]/)[0]).find((n) => ['glass', 'metal', 'holder', 'gold', 'light'].includes(n)) ?? 'metal';
            parts.push({ role, geometry });
        });
        const box = new THREE.Box3().setFromObject(scene);
        return { parts, height: box.max.y - box.min.y };
    }, [scene]);
}

/** Lamp uit het echte model: hangt aan het snoer vanaf het ophangpunt tot de bovenkant van het model. */
function ModelLamp({ glass, name, bottom, x, z, anchorY }: { glass: Option; name: string; bottom: number; x: number; z: number; anchorY: number }) {
    const { parts, height } = useModel(name);
    const materials = useMemo(() => materialsFor(glass, name), [glass, name]);
    return (
        <group>
            <Rod from={new THREE.Vector3(x, anchorY, z)} to={new THREE.Vector3(x, bottom + height, z)} radius={glass.meta.fitting === 'LED' ? 0.0015 : 0.003} />
            <group position={[x, bottom, z]}>
                {parts.map(({ role, geometry }, i) => (
                    <mesh key={i} geometry={geometry} material={materials[role] ?? BLACK} castShadow={role !== 'light'} />
                ))}
            </group>
        </group>
    );
}

function Glass(props: { glass: Option; bottom: number; x: number; z: number; anchorY: number }) {
    const model = modelFor(props.glass);
    if (!model) return <SimpleGlass {...props} />;
    // Tijdens het laden van het model de eenvoudige vorm tonen.
    return (
        <Suspense fallback={<SimpleGlass {...props} />}>
            <ModelLamp {...props} name={model} />
        </Suspense>
    );
}

/** Benadering met een gedraaid profiel, voor lampen waarvan nog geen 3D-bestand is. */
function SimpleGlass({ glass, bottom, x, z, anchorY }: { glass: Option; bottom: number; x: number; z: number; anchorY: number }) {
    const shape = glass.meta.shape as string;
    const radius = glass.meta.diameter / 2000;
    const height = glass.meta.height / 1000;
    const geometry = useMemo(() => profileGeometry(shape), [shape]);
    const material = useMemo(() => materialFor(glass.meta), [glass.meta]);
    const shade = shape === 'sliced' || shape === 'tommy';
    const top = bottom + height;

    return (
        <group>
            <Rod from={new THREE.Vector3(x, anchorY, z)} to={new THREE.Vector3(x, top + 0.03, z)} radius={glass.meta.fitting === 'LED' ? 0.0015 : 0.003} />
            {/* Fitting */}
            <mesh position={[x, top + 0.015, z]} material={BLACK}>
                <cylinderGeometry args={[0.016, 0.016, 0.05, 16]} />
            </mesh>
            <group position={[x, bottom, z]} scale={[radius, height, radius]}>
                <mesh geometry={geometry} material={material} castShadow />
                {shade && <mesh geometry={geometry} material={GOLD} scale={[0.98, 0.99, 0.98]} />}
            </group>
            {/* Lichtbron */}
            <mesh position={[x, bottom + height * (shade ? 0.15 : 0.45), z]}>
                <sphereGeometry args={[Math.min(0.025, radius * 0.35), 16, 16]} />
                <meshStandardMaterial color="#ffd49a" emissive="#ffb35c" emissiveIntensity={3} toneMapped={false} />
            </mesh>
        </group>
    );
}

function Base({ base, points, color }: { base: Option | undefined; points: ReturnType<typeof anchors>; color: BaseColor }) {
    // Kleur van de plafondbasis (zwart, wit, brons of RVS), ook voor de armen van spreader en spider.
    const finish = useMemo(() => {
        const c = BASE_COLORS[color] ?? BASE_COLORS.zwart;
        return new THREE.MeshStandardMaterial({ color: c.hex, metalness: c.metal ? 0.85 : 0.3, roughness: c.metal ? 0.3 : 0.55 });
    }, [color]);
    if (!base) return null;
    const { type, shape } = base.meta;
    const canopy = (base.meta.canopy_diameter ?? 120) / 2000;

    if (type === 'canopy' || type === 'spreader') {
        return (
            <group>
                <mesh position={[0, -0.02, 0]} material={finish}>
                    <cylinderGeometry args={[canopy, canopy, 0.04, 32]} />
                </mesh>
                {type === 'spreader' && (
                    <>
                        <Rod from={new THREE.Vector3(0, -0.04, 0)} to={new THREE.Vector3(0, -0.12, 0)} radius={0.006} material={finish} />
                        {points.map((p, i) => (
                            <Rod key={i} from={new THREE.Vector3(0, -0.12, 0)} to={new THREE.Vector3(p.x, p.y, p.z)} radius={0.005} material={finish} />
                        ))}
                    </>
                )}
            </group>
        );
    }

    if (type === 'spider') {
        return (
            <group>
                <mesh position={[0, -0.03, 0]} material={finish}>
                    <cylinderGeometry args={[0.05, 0.06, 0.06, 24]} />
                </mesh>
                {points.map((p, i) => (
                    <Rod key={i} from={new THREE.Vector3(0, -0.05, 0)} to={new THREE.Vector3(p.x, p.y, p.z)} radius={0.006} material={finish} />
                ))}
            </group>
        );
    }

    // XL-plafondplaat
    if (shape === 'round') {
        const r = base.meta.diameter / 2000;
        return (
            <mesh position={[0, -0.0125, 0]} material={finish}>
                <cylinderGeometry args={[r, r, 0.025, 64]} />
            </mesh>
        );
    }

    return (
        <mesh position={[0, -0.0125, 0]} material={finish}>
            <boxGeometry args={[base.meta.width / 1000, 0.025, base.meta.depth / 1000]} />
        </mesh>
    );
}

export default function Viewer3D() {
    const data = useConfigurator((s) => s.data);
    const selections = useConfigurator((s) => s.selections);
    const base = isStandalone({ data, selections }) ? undefined : option(data, 'base', selections.base);
    const glasses = glassPerPosition({ data, selections });

    const length = selections.length === 'custom' ? (selections.custom_length ?? 1.5) : (selections.length ?? 1.5);
    // Kappen met ingebouwde pendel (Sliced, Tommy) hangen standaard op 1,5 m.
    const cable = selections.length !== 'custom' && glasses.every((g) => g?.meta.pendant_included) ? (glasses[0]?.meta.cable_length ?? 1.5) : length;

    const points = useMemo(() => anchors(base), [base]);
    const bottoms = useMemo(() => drops(points, selections.composition, cable), [points, selections.composition, cable]);

    const width = base ? Math.max(base.meta.width ?? 0, base.meta.diameter ?? 0) / 1000 : 0.4;
    const scene = useConfigurator((s) => s.scene);
    const person = useConfigurator((s) => s.person);
    const lowest = Math.min(-cable, ...bottoms.slice(0, points.length));
    // Met alleen het silhouet hangt de lamp op eettafelhoogte boven de vloer, zodat de maatverhouding klopt.
    const floor = floorFor(scene === 'none' && person ? 'dining' : scene, lowest);
    const room = scene !== 'none' || person;
    // Met sfeer of persoon in beeld kijkt de camera naar de hele ruimte (plafond tot vloer), anders naar de lamp.
    // De wenteltrap staat rond de lamp: zijn doorsnede is de lampbreedte plus 2,3 m.
    const span = room ? Math.max(width + (scene === 'stairs' ? 2.3 : 0) + (person ? 2.4 : 1.5), -floor) : Math.max(width, cable);
    const distance = span * 1.6 + 0.6;
    const target: [number, number, number] = [0, room ? floor / 2 : -cable / 2, 0];

    return (
        <Canvas
            shadows
            camera={{ position: [distance * 0.6, target[1] + span * 0.15, distance], fov: 40 }}
            dpr={[1, 2]}
            // Nodig om het beeld als PNG of PDF te kunnen downloaden.
            gl={{ preserveDrawingBuffer: true }}
            onCreated={({ gl }) => setViewerCanvas(gl.domElement)}
        >
            <CameraRig distance={distance} target={target} span={span} />
            <color attach="background" args={['#f3f1ed']} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[3, 2, 4]} intensity={1.2} castShadow />
            <Environment resolution={256}>
                <Lightformer intensity={2} position={[0, 5, -9]} scale={[10, 10, 1]} />
                <Lightformer intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
                <Lightformer intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
            </Environment>

            {/* Plafond */}
            <mesh rotation-x={Math.PI / 2} position={[0, 0.001, 0]}>
                <planeGeometry args={[12, 12]} />
                {/* Onverlicht materiaal: het licht komt van boven, dus anders wordt het plafond donker. */}
                <meshBasicMaterial color="#ebe8e2" side={THREE.DoubleSide} />
            </mesh>

            <Base base={base} points={points} color={selections.base_color} />
            {points.map((p, i) => {
                const glass = glasses[i];
                return glass ? <Glass key={i} glass={glass} bottom={bottoms[i]} x={p.x} z={p.z} anchorY={p.y} /> : null;
            })}

            <Furniture scene={scene} floor={floor} width={width} person={person} />
            <ContactShadows position={[0, floor + 0.002, 0]} opacity={0.35} scale={8} blur={2.5} far={3} />
            <OrbitControls makeDefault target={target} enablePan={false} minDistance={0.5} maxDistance={16} />
        </Canvas>
    );
}

/** Zet de camera opnieuw goed als de sfeer of de lamp verandert (de camera van <Canvas> wordt maar één keer ingesteld). */
function CameraRig({ distance, target, span }: { distance: number; target: [number, number, number]; span: number }) {
    const camera = useThree((s) => s.camera);
    const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
    useEffect(() => {
        camera.position.set(distance * 0.6, target[1] + span * 0.15, distance);
        controls?.target.set(...target);
        controls?.update();
    }, [camera, controls, distance, span, target[1]]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}
