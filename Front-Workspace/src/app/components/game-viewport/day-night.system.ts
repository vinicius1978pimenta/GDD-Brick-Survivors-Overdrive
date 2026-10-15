import * as THREE from 'three';
import { DayNightCycleState, TimeOfDayPhase } from './interfaces/game-viewport.interface';

/**
 * Sistema de iluminação astronômica e ciclo dinâmico Dia/Noite.
 * Orbita Sol/Lua (DirectionalLight) na arena 100x100 com transição suave
 * de céu, sombras, estrelas e acendimento automático de faróis e lanternas.
 */
export class DayNightSystem {
  public elapsedTime = 0;
  public cycleDuration = 90; // 90 segundos para uma rotação completa de 24h

  private readonly starField: THREE.Points;
  public heroFlashlight: THREE.SpotLight | null = null;
  public vehicleHeadlights: THREE.SpotLight[] = [];
  public vehicleHeadlightMaterial: THREE.MeshStandardMaterial | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sunLight: THREE.DirectionalLight,
    private readonly ambientLight: THREE.AmbientLight,
    private readonly hemiLight: THREE.HemisphereLight,
    cycleDuration = 90,
  ) {
    this.cycleDuration = cycleDuration;
    this.starField = this.createStarField();
    this.scene.add(this.starField);
  }

  /**
   * Atualiza a posição do Sol/Lua, cores do céu e estados de iluminação noturna.
   */
  public update(delta: number): DayNightCycleState {
    this.elapsedTime += delta;
    const timeOfDay = (this.elapsedTime % this.cycleDuration) / this.cycleDuration;
    const sunAngle = timeOfDay * Math.PI * 2;

    const orbitRadius = 65;
    const sunX = Math.cos(sunAngle) * orbitRadius;
    const sunY = Math.sin(sunAngle) * orbitRadius;
    const sunZ = Math.sin(sunAngle * 0.4) * (orbitRadius * 0.6);

    const elevation = Math.sin(sunAngle);
    let phase: TimeOfDayPhase = 'day';
    const isNight = elevation < -0.15;

    if (elevation > 0.25) {
      phase = 'day';
      // Dia claro: sol branco/dourado brilhante, ambiente claro
      this.sunLight.position.set(sunX, Math.max(15, sunY), sunZ);
      this.sunLight.color.setHex(0xfffaed);
      this.sunLight.intensity = 1.35;
      this.sunLight.castShadow = true;

      this.ambientLight.color.setHex(0xdde6ed);
      this.ambientLight.intensity = 0.6;

      this.hemiLight.color.setHex(0x60a5fa);
      this.hemiLight.groundColor.setHex(0x1e293b);
      this.hemiLight.intensity = 0.45;

      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.setHex(0x38bdf8);
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x38bdf8);
        this.scene.fog.density = 0.007;
      }

      this.setStarOpacity(0);
      this.setNightLights(false, 0.9);
    } else if (elevation >= -0.15 && elevation <= 0.25) {
      phase = elevation >= 0 ? 'sunset' : 'sunrise';
      // Entardecer / Amanhecer: luz dourada/alaranjada oblíqua
      this.sunLight.position.set(sunX, Math.max(5, sunY), sunZ);
      this.sunLight.color.setHex(0xf97316);
      this.sunLight.intensity = 1.05;

      this.ambientLight.color.setHex(0x78716c);
      this.ambientLight.intensity = 0.42;

      this.hemiLight.color.setHex(0xa855f7);
      this.hemiLight.groundColor.setHex(0x451a03);
      this.hemiLight.intensity = 0.35;

      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.setHex(0x9a3412);
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x9a3412);
        this.scene.fog.density = 0.009;
      }

      this.setStarOpacity(0.35);
      this.setNightLights(true, 1.5);
    } else {
      phase = 'night';
      // Noite profunda: Lua azulada tênue no céu estrelado
      this.sunLight.position.set(-sunX, Math.max(10, -sunY), -sunZ);
      this.sunLight.color.setHex(0x60a5fa);
      this.sunLight.intensity = 0.32;
      this.sunLight.castShadow = false;

      this.ambientLight.color.setHex(0x0f172a);
      this.ambientLight.intensity = 0.22;

      this.hemiLight.color.setHex(0x1e293b);
      this.hemiLight.groundColor.setHex(0x090d16);
      this.hemiLight.intensity = 0.2;

      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.setHex(0x090d16);
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x090d16);
        this.scene.fog.density = 0.012;
      }

      this.setStarOpacity(0.9);
      this.setNightLights(true, 2.5);
    }

    return {
      timeOfDay,
      phase,
      sunElevation: elevation,
      isNight,
    };
  }

  private setStarOpacity(opacity: number): void {
    if (this.starField.material instanceof THREE.PointsMaterial) {
      this.starField.material.opacity = opacity;
    }
  }

  private setNightLights(enabled: boolean, emissiveIntensity: number): void {
    if (this.heroFlashlight) {
      this.heroFlashlight.visible = enabled;
    }
    for (const spot of this.vehicleHeadlights) {
      spot.visible = enabled;
    }
    if (this.vehicleHeadlightMaterial) {
      this.vehicleHeadlightMaterial.emissiveIntensity = emissiveIntensity;
    }
  }

  private createStarField(): THREE.Points {
    const starCount = 450;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.15); // Hemisfério superior
      const radius = 80 + Math.random() * 15;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) + 5;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.1,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
    });

    return new THREE.Points(starGeo, starMat);
  }

  public dispose(): void {
    if (this.starField) {
      this.scene.remove(this.starField);
      this.starField.geometry.dispose();
      if (this.starField.material instanceof THREE.Material) {
        this.starField.material.dispose();
      }
    }
    for (const spot of this.vehicleHeadlights) {
      spot.dispose();
    }
    this.vehicleHeadlights = [];
    if (this.heroFlashlight) {
      this.heroFlashlight.dispose();
      this.heroFlashlight = null;
    }
  }
}
