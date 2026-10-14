import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let app: App;

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
      imports: [App],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    app = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('deve instanciar o componente raiz App com sucesso', () => {
    expect(app).toBeTruthy();
  });

  it('deve renderizar o título do jogo no header', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.game-title')?.textContent).toContain('Brick Survivors: Overdrive');
  });

  it('deve conter a tag do GameViewportComponent na área principal', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-game-viewport')).not.toBeNull();
  });
});
