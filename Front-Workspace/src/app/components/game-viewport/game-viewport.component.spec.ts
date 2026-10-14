import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameViewportComponent } from './game-viewport.component';

describe('GameViewportComponent', () => {
  let component: GameViewportComponent;
  let fixture: ComponentFixture<GameViewportComponent>;

  beforeAll(() => {
    if (typeof window.ResizeObserver === 'undefined') {
      window.ResizeObserver = class {
        public observe = vi.fn();
        public unobserve = vi.fn();
        public disconnect = vi.fn();
      } as unknown as typeof ResizeObserver;
    }
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameViewportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameViewportComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('deve criar a instância do componente com sucesso', () => {
    expect(component).toBeTruthy();
    expect(component.world).toBeDefined();
  });

  it('deve conter o container de viewport, canvas e elementos do HUD da Fase 3 no DOM', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const container = compiled.querySelector('.viewport-container');
    const canvas = compiled.querySelector('canvas.render-canvas');
    const speedCard = compiled.querySelector('.speedometer-card');
    const modeBadge = compiled.querySelector('.mode-badge');

    expect(container).not.toBeNull();
    expect(canvas).not.toBeNull();
    expect(speedCard).not.toBeNull();
    expect(modeBadge?.textContent).toContain('A PÉ (HERÓI)');

    // Blindagem não deve ser exibida a pé
    expect(compiled.querySelector('.durability-card')).toBeNull();

    // Blindagem deve ser exibida ao pilotar o veículo
    component.isDriving.set(true);
    fixture.detectChanges();
    const durabilityCard = compiled.querySelector('.durability-card');
    expect(durabilityCard?.textContent).toContain('BLINDAGEM');
  });

  it('deve exibir o alerta de DRIFT quando o sinal isDrifting estiver ativo', () => {
    component.isDrifting.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const driftBadge = compiled.querySelector('.badge-drift');

    expect(driftBadge).not.toBeNull();
    expect(driftBadge?.textContent).toContain('DRIFT OVERDRIVE!');
  });

  it('deve exibir o prompt contextual de interação quando o herói estiver próximo do veículo', () => {
    component.canInteract.set(true);
    component.isDriving.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const prompt = compiled.querySelector('.prompt-interact');

    expect(prompt).not.toBeNull();
    expect(prompt?.textContent).toContain('Dirigir Buggy de Blocos');
  });

  it('deve exibir o prompt de desembarque quando estiver pilotando o veículo', () => {
    component.isDriving.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const prompt = compiled.querySelector('.prompt-dismount');

    expect(prompt).not.toBeNull();
    expect(prompt?.textContent).toContain('Desembarcar do Veículo');
  });

  it('deve capturar eventos do teclado (WASD, Espaço e E) atualizando o estado do mundo', () => {
    fixture.detectChanges();

    // Pressiona W (acelerar / forward)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(component.world.inputState.forward).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(component.world.inputState.forward).toBe(false);

    // Pressiona S (ré / backward)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    expect(component.world.inputState.backward).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    expect(component.world.inputState.backward).toBe(false);

    // Pressiona A (esquerda / left)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(component.world.inputState.left).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    expect(component.world.inputState.left).toBe(false);

    // Pressiona D (direita / right)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(component.world.inputState.right).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    expect(component.world.inputState.right).toBe(false);

    // Pressiona ArrowRight (direita / right alternativa)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    expect(component.world.inputState.right).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
    expect(component.world.inputState.right).toBe(false);

    // Pressiona Espaço a pé -> deve acionar jump
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(component.world.inputState.jump).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(component.world.inputState.jump).toBe(false);

    // Quando pilotando o veículo -> deve acionar handbrake
    component.world.vehicleComponent.driverEntityId = component.world.heroId;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(component.world.inputState.handbrake).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(component.world.inputState.handbrake).toBe(false);

    // Pressiona E (interact)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    expect(component.world.inputState.interact).toBe(true);

    // Pressiona K enquanto pilotando -> NÃO deve descolar bloco
    const durabilityWhileDriving = component.world.getDurabilityPercentage();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }));
    expect(component.world.getDurabilityPercentage()).toBe(durabilityWhileDriving);
    expect(component.world.activeDebris.length).toBe(0);

    // Desembarca herói (a pé)
    component.world.vehicleComponent.driverEntityId = null;

    // Pressiona K a pé -> descola bloco normalmente
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }));
    expect(component.world.getDurabilityPercentage()).toBeLessThan(durabilityWhileDriving);
    expect(component.world.activeDebris.length).toBeGreaterThan(0);
  });

  it('não deve exibir a instrução da tecla K no painel de controles do HUD nem a pé nem pilotando', () => {
    // A pé
    component.isDriving.set(false);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    let kbdK = Array.from(compiled.querySelectorAll('.instruction-item kbd')).find(
      (el) => el.textContent?.trim() === 'K',
    );
    expect(kbdK).toBeUndefined();

    // Pilotando
    component.isDriving.set(true);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    kbdK = Array.from(compiled.querySelectorAll('.instruction-item kbd')).find(
      (el) => el.textContent?.trim() === 'K',
    );
    expect(kbdK).toBeUndefined();
  });

  it('não deve exibir o prompt de entrar nem a instrução E quando o veículo estiver inacessível ou destruído', () => {
    // Longe ou destruído -> canInteract é false
    component.isDriving.set(false);
    component.canInteract.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const promptInteract = compiled.querySelector('.prompt-interact');
    expect(promptInteract).toBeNull();

    const kbdE = Array.from(compiled.querySelectorAll('.instruction-item kbd')).find(
      (el) => el.textContent?.trim() === 'E',
    );
    expect(kbdE).toBeUndefined();
  });

  it('deve executar o ciclo de vida ngAfterViewInit e ngOnDestroy limpando recursos sem erros', () => {
    fixture.detectChanges();

    expect(() => {
      component.ngOnDestroy();
    }).not.toThrow();
  });
});
