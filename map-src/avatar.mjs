/** Blocky campus walker. Front faces -Z, feet sit on y = 0. */

import * as THREE from "three";

const SKIN = 0xf0c6a0;

const LOOKS = {
  guest: {
    hair: 0x3a3a3a, coat: 0x6e6e6e, coatDark: 0x5e5e5e, pants: 0x3d3d3d, shoe: 0x3d3d3d, pack: 0x5a5a5a, strap: 0x4e4e4e, style: "guest",
  },
  male: {
    hair: 0x241d1a, coat: 0x2f4f6f, coatDark: 0x243c55, pants: 0x3a4048, shoe: 0x212327, pack: 0x8a5a3a, strap: 0x6b432a, style: "male",
  },
  female: {
    hair: 0x241d1a, coat: 0x8a6a4a, coatDark: 0x6e5438, pants: 0x2a2a32, shoe: 0x212327, pack: 0x2c3a4a, strap: 0x243140, style: "female",
  },
};

export const AVATAR_HEIGHT_M = 1.86;

function block(w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.avatar = true;
  return mesh;
}

/** Low-poly student. Guest, male, and female share this skeleton. */
export function buildAvatar() {
  const group = new THREE.Group();
  group.name = "campus-avatar";
  const body = new THREE.Group();
  body.name = "campus-avatar-body";
  const look = LOOKS.guest;

  const torso = block(0.46, 0.62, 0.28, look.coat);
  torso.position.y = 1.1;
  const belt = block(0.47, 0.08, 0.29, look.coatDark);
  belt.position.y = 0.82;

  const pack = block(0.38, 0.44, 0.16, look.pack);
  pack.position.set(0, 1.12, 0.21);
  const strapL = block(0.05, 0.5, 0.02, look.strap);
  strapL.position.set(-0.13, 1.14, -0.145);
  const strapR = strapL.clone();
  strapR.position.x = 0.13;

  const head = new THREE.Group();
  head.name = "campus-avatar-head";
  head.position.y = 1.63;
  const skull = block(0.42, 0.42, 0.4, SKIN);
  const hair = block(0.4, 0.1, 0.38, look.hair);
  hair.position.y = 0.18;
  const fringe = block(0.44, 0.09, 0.04, look.hair);
  fringe.position.set(0, 0.13, -0.2);
  const hairBack = block(0.32, 0.14, 0.03, look.hair);
  hairBack.position.set(0, 0.11, 0.205);
  const bob = block(0.4, 0.36, 0.08, look.hair);
  bob.position.set(0, -0.08, 0.18);
  const eyeL = block(0.06, 0.07, 0.03, 0x1b1b1f);
  eyeL.position.set(-0.09, 0.02, -0.205);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  head.add(skull, hair, fringe, hairBack, bob, eyeL, eyeR);

  const armL = new THREE.Group();
  armL.name = "campus-avatar-arm-left";
  armL.position.set(-0.3, 1.36, 0);
  const armLMesh = block(0.16, 0.62, 0.18, look.coat);
  armLMesh.position.y = -0.3;
  const handL = block(0.15, 0.12, 0.17, SKIN);
  handL.position.y = -0.64;
  armL.add(armLMesh, handL);
  const armR = armL.clone();
  armR.name = "campus-avatar-arm-right";
  armR.position.x = 0.3;

  const legL = new THREE.Group();
  legL.name = "campus-avatar-leg-left";
  legL.position.set(-0.12, 0.8, 0);
  const legLMesh = block(0.2, 0.72, 0.24, look.pants);
  legLMesh.position.y = -0.36;
  const shoeL = block(0.21, 0.12, 0.3, look.shoe);
  shoeL.position.set(0, -0.74, -0.03);
  legL.add(legLMesh, shoeL);
  const legR = legL.clone();
  legR.name = "campus-avatar-leg-right";
  legR.position.x = 0.12;

  body.add(torso, belt, pack, strapL, strapR, head, armL, armR, legL, legR);
  const parts = {
    torso, belt, pack, strapL, strapR, hair, fringe, hairBack, bob,
    armL: armLMesh, armR: armR.children[0],
    legL: legLMesh, legR: legR.children[0],
    shoeL, shoeR: legR.children[1],
  };
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }),
  );
  shadow.name = "campus-avatar-shadow";
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.15, 0.85, 1);
  shadow.position.y = 0.03;
  shadow.userData.avatar = true;
  group.add(body, shadow);
  group.visible = false;
  const avatar = { group, body, head, armL, armR, legL, legR, parts, kind: "guest" };
  applyAvatarLook(avatar, "guest");
  return avatar;
}

function paint(mesh, hex) {
  if (mesh && mesh.material && mesh.material.color) mesh.material.color.setHex(hex);
}

/** Recolor the shared skeleton. Female adds a shoulder-length bob; guest stays plain. */
export function applyAvatarLook(avatar, kind) {
  const look = LOOKS[kind] || LOOKS.guest;
  const parts = avatar.parts;
  if (!parts) return;
  avatar.kind = look.style;
  paint(parts.torso, look.coat);
  paint(parts.belt, look.coatDark);
  paint(parts.armL, look.coat);
  paint(parts.armR, look.coat);
  paint(parts.pack, look.pack);
  paint(parts.strapL, look.strap);
  paint(parts.strapR, look.strap);
  paint(parts.legL, look.pants);
  paint(parts.legR, look.pants);
  paint(parts.shoeL, look.shoe);
  paint(parts.shoeR, look.shoe);
  paint(parts.hair, look.hair);
  paint(parts.fringe, look.hair);
  paint(parts.hairBack, look.hair);
  paint(parts.bob, look.hair);
  parts.fringe.visible = look.style === "male";
  parts.hairBack.visible = look.style === "male";
  parts.bob.visible = look.style === "female";
}

/** Place and animate the avatar; hidden in first person. */
export function poseAvatar(avatar, state) {
  if (!avatar || !avatar.group) return;
  const on = !!state.visible;
  avatar.group.visible = on;
  if (!on) return;
  const x = state.x || 0;
  const y = state.y || 0;
  const z = state.z || 0;
  avatar.group.position.set(x, y, z);
  // Model front is -Z; the player's yaw 0 also faces -Z, so mirror the yaw.
  avatar.group.rotation.y = -(state.yaw || 0);
  const speed = Math.max(0, Math.min(1, (state.speed || 0) / 4.2));
  const phase = state.phase || 0;
  const swing = Math.sin(phase) * 0.72 * speed;
  if (state.grounded === false) {
    avatar.legL.rotation.x = 0.32;
    avatar.legR.rotation.x = -0.18;
    avatar.armL.rotation.x = -0.42;
    avatar.armR.rotation.x = -0.42;
  } else {
    avatar.legL.rotation.x = swing;
    avatar.legR.rotation.x = -swing;
    avatar.armL.rotation.x = -swing * 0.8;
    avatar.armR.rotation.x = swing * 0.8;
  }
  avatar.head.rotation.x = Math.max(-0.5, Math.min(0.5, -(state.pitch || 0) * 0.45));
}

