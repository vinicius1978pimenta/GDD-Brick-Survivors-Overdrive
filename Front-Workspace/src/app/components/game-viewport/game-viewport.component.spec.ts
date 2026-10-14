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

    // Solta W
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(component.world.inputState.forward).toBe(false);

    // Pressiona Espaço (handbrake)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(component.world.inputState.handbrake).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(component.world.inputState.handbrake).toBe(false);

    // Pressiona E (interact)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    expect(component.world.inputState.interact).toBe(true);
  });

  it('deve executar o ciclo de vida ngAfterViewInit e ngOnDestroy limpando recursos sem erros', () => {
    fixture.detectChanges();

    expect(() => {
      component.ngOnDestroy();
    }).not.toThrow();
  });
});
