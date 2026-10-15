import * as THREE from 'three';
import { DayNightCycleState, TimeOfDayPhase } from './interfaces/game-viewport.interface';

/**
 * Sistema de iluminação astronômica e ciclo dinâmico Dia/Noite.
 * Orbita Sol/Lua (DirectionalLight) na arena 100x100 com transição suave
 * de céu, sombras, estrelas e acendimento automático de faróis e lanternas.
 */
export class DayNightSystem {
  public elapsedTime = 0;
  public cycleDuration = 360; // 360 segundos (6 minutos) para ciclo astronômico realista e suave

  private readonly starField: THREE.Points;
  public heroFlashlight: THREE.SpotLight | null = null;
  public vehicleHeadlights: THREE.SpotLight[] = [];
  public vehicleHeadlightMaterial: THREE.MeshStandardMaterial | null = null;

  // Paletas de cores para interpolação contínua (lerp suave sem saltos)
  private readonly colorSunDay = new THREE.Color(0xfffaed);
  private readonly colorSunSunset = new THREE.Color(0xf97316);
  private readonly colorSunNight = new THREE.Color(0x60a5fa);
  private readonly colorSunSunrise = new THREE.Color(0xfb923c);

  private readonly colorAmbDay = new THREE.Color(0xdde6ed);
  private readonly colorAmbSunset = new THREE.Color(0x78716c);
  private readonly colorAmbNight = new THREE.Color(0x0f172a);
  private readonly colorAmbSunrise = new THREE.Color(0x6b7280);

  private readonly colorSkyDay = new THREE.Color(0x38bdf8);
  private readonly colorSkySunset = new THREE.Color(0x9a3412);
  private readonly colorSkyNight = new THREE.Color(0x090d16);
  private readonly colorSkySunrise = new THREE.Color(0xe11d48);

  private readonly colorHemiSkyDay = new THREE.Color(0x60a5fa);
  private readonly colorHemiSkySunset = new THREE.Color(0xa855f7);
  private readonly colorHemiSkyNight = new THREE.Color(0x1e293b);

  private readonly colorHemiGroundDay = new THREE.Color(0x1e293b);
  private readonly colorHemiGroundSunset = new THREE.Color(0x451a03);
  private readonly colorHemiGroundNight = new THREE.Color(0x090d16);

  private readonly currentSunColor = new THREE.Color();
  private readonly currentAmbColor = new THREE.Color();
  private readonly currentSkyColor = new THREE.Color();
  private readonly currentHemiSkyColor = new THREE.Color();
  private readonly currentHemiGroundColor = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sunLight: THREE.DirectionalLight,
    private readonly ambientLight: THREE.AmbientLight,
    private readonly hemiLight: THREE.HemisphereLight,
    cycleDuration = 360,
  ) {
    this.cycleDuration = cycleDuration;
    this.starField = this.createStarField();
    this.scene.add(this.starField);
  }

  /**
   * Força um instante específico do ciclo astronômico (0 = meio-dia, 0.5 = meia-noite).
   */
  public setTimeOfDay(fraction: number): void {
    this.elapsedTime = (fraction % 1) * this.cycleDuration;
  }

  /**
   * Atualiza a posição do Sol/Lua, cores do céu e estados de iluminação noturna.
   * Suporta sincronização determinística entre múltiplos navegadores via syncedTimestamp
   * com interpolação contínua (Color.lerp) de todas as fontes lumínicas e neblina.
   */
  public update(delta = 0.016, syncedTimestamp?: number): DayNightCycleState {
    if (syncedTimestamp !== undefined && syncedTimestamp > 0) {
      const cycleSeconds = (syncedTimestamp / 1000) % this.cycleDuration;
      this.elapsedTime = cycleSeconds;
    } else {
      this.elapsedTime += delta;
    }
    const timeOfDay = (this.elapsedTime % this.cycleDuration) / this.cycleDuration;
    const sunAngle = timeOfDay * Math.PI * 2;

    const orbitRadius = 90;
    const sunX = Math.cos(sunAngle) * orbitRadius;
    const sunY = Math.sin(sunAngle) * orbitRadius;
    const sunZ = Math.sin(sunAngle * 0.4) * (orbitRadius * 0.6);

    const elevation = Math.sin(sunAngle);
    let phase: TimeOfDayPhase = 'day';
    const isNight = elevation < -0.15;

    if (elevation > 0.25) {
      phase = 'day';
    } else if (elevation >= -0.15 && elevation <= 0.25) {
      phase = elevation >= 0 ? 'sunset' : 'sunrise';
    } else {
      phase = 'night';
    }

    // Interpolação Contínua em 4 Quadrantes (0..0.25 Sunrise->Day, 0.25..0.50 Day->Sunset, 0.50..0.75 Sunset->Night, 0.75..1.0 Night->Sunrise)
    let sunIntensity = 1.35;
    let ambIntensity = 0.6;
    let hemiIntensity = 0.45;
    let fogDensity = 0.007;
    let starOpacity = 0.0;
    let nightLightsEmissive = 0.9;
    let nightLightsActive = false;

    if (timeOfDay < 0.25) {
      // Sunrise -> Day
      const u = timeOfDay / 0.25;
      this.currentSunColor.copy(this.colorSunSunrise).lerp(this.colorSunDay, u);
      this.currentAmbColor.copy(this.colorAmbSunrise).lerp(this.colorAmbDay, u);
      this.currentSkyColor.copy(this.colorSkySunrise).lerp(this.colorSkyDay, u);
      this.currentHemiSkyColor.copy(this.colorHemiSkySunset).lerp(this.colorHemiSkyDay, u);
      this.currentHemiGroundColor.copy(this.colorHemiGroundSunset).lerp(this.colorHemiGroundDay, u);

      sunIntensity = THREE.MathUtils.lerp(1.05, 1.35, u);
      ambIntensity = THREE.MathUtils.lerp(0.40, 0.60, u);
      hemiIntensity = THREE.MathUtils.lerp(0.32, 0.45, u);
      fogDensity = THREE.MathUtils.lerp(0.008, 0.006, u);
      starOpacity = THREE.MathUtils.lerp(0.3, 0.0, u);
      nightLightsActive = u < 0.2;
      nightLightsEmissive = THREE.MathUtils.lerp(1.5, 0.9, u);
    } else if (timeOfDay < 0.5) {
      // Day -> Sunset
      const u = (timeOfDay - 0.25) / 0.25;
      this.currentSunColor.copy(this.colorSunDay).lerp(this.colorSunSunset, u);
      this.currentAmbColor.copy(this.colorAmbDay).lerp(this.colorAmbSunset, u);
      this.currentSkyColor.copy(this.colorSkyDay).lerp(this.colorSkySunset, u);
      this.currentHemiSkyColor.copy(this.colorHemiSkyDay).lerp(this.colorHemiSkySunset, u);
      this.currentHemiGroundColor.copy(this.colorHemiGroundDay).lerp(this.colorHemiGroundSunset, u);

      sunIntensity = THREE.MathUtils.lerp(1.35, 1.05, u);
      ambIntensity = THREE.MathUtils.lerp(0.60, 0.42, u);
      hemiIntensity = THREE.MathUtils.lerp(0.45, 0.35, u);
      fogDensity = THREE.MathUtils.lerp(0.006, 0.009, u);
      starOpacity = THREE.MathUtils.lerp(0.0, 0.35, u);
      nightLightsActive = u > 0.8;
      nightLightsEmissive = THREE.MathUtils.lerp(0.9, 1.5, u);
    } else if (timeOfDay < 0.75) {
      // Sunset -> Night
      const u = (timeOfDay - 0.5) / 0.25;
      this.currentSunColor.copy(this.colorSunSunset).lerp(this.colorSunNight, u);
      this.currentAmbColor.copy(this.colorAmbSunset).lerp(this.colorAmbNight, u);
      this.currentSkyColor.copy(this.colorSkySunset).lerp(this.colorSkyNight, u);
      this.currentHemiSkyColor.copy(this.colorHemiSkySunset).lerp(this.colorHemiSkyNight, u);
      this.currentHemiGroundColor.copy(this.colorHemiGroundSunset).lerp(this.colorHemiGroundNight, u);

      sunIntensity = THREE.MathUtils.lerp(1.05, 0.32, u);
      ambIntensity = THREE.MathUtils.lerp(0.42, 0.22, u);
      hemiIntensity = THREE.MathUtils.lerp(0.35, 0.20, u);
      fogDensity = THREE.MathUtils.lerp(0.009, 0.012, u);
      starOpacity = THREE.MathUtils.lerp(0.35, 0.95, u);
      nightLightsActive = true;
      nightLightsEmissive = THREE.MathUtils.lerp(1.5, 2.5, u);
    } else {
      // Night -> Sunrise
      const u = (timeOfDay - 0.75) / 0.25;
      this.currentSunColor.copy(this.colorSunNight).lerp(this.colorSunSunrise, u);
      this.currentAmbColor.copy(this.colorAmbNight).lerp(this.colorAmbSunrise, u);
      this.currentSkyColor.copy(this.colorSkyNight).lerp(this.colorSkySunrise, u);
      this.currentHemiSkyColor.copy(this.colorHemiSkyNight).lerp(this.colorHemiSkySunset, u);
      this.currentHemiGroundColor.copy(this.colorHemiGroundNight).lerp(this.colorHemiGroundSunset, u);

      sunIntensity = THREE.MathUtils.lerp(0.32, 1.05, u);
      ambIntensity = THREE.MathUtils.lerp(0.22, 0.40, u);
      hemiIntensity = THREE.MathUtils.lerp(0.20, 0.32, u);
      fogDensity = THREE.MathUtils.lerp(0.012, 0.008, u);
      starOpacity = THREE.MathUtils.lerp(0.95, 0.3, u);
      nightLightsActive = true;
      nightLightsEmissive = THREE.MathUtils.lerp(2.5, 1.5, u);
    }

    // Aplicação das luminâncias e cores suaves
    if (!isNight) {
      this.sunLight.position.set(sunX, Math.max(8, sunY), sunZ);
      this.sunLight.castShadow = true;
    } else {
      // Posição oposta para lua noturna suave
      this.sunLight.position.set(-sunX, Math.max(10, -sunY), -sunZ);
      this.sunLight.castShadow = false;
    }

    this.sunLight.color.copy(this.currentSunColor);
    this.sunLight.intensity = sunIntensity;

    this.ambientLight.color.copy(this.currentAmbColor);
    this.ambientLight.intensity = ambIntensity;

    this.hemiLight.color.copy(this.currentHemiSkyColor);
    this.hemiLight.groundColor.copy(this.currentHemiGroundColor);
    this.hemiLight.intensity = hemiIntensity;

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.currentSkyColor);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.currentSkyColor);
      this.scene.fog.density = fogDensity;
    }

    this.setStarOpacity(starOpacity);
    this.setNightLights(nightLightsActive || isNight, nightLightsEmissive);

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
