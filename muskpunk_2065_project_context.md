# MUSKPUNK 2065 — 프로젝트 작업 맥락 및 아키텍처 정리

> **"HE GAVE US MARS. HE OWNS THE AIR."**  
> **"WELCOME TO MARS. TERMS APPLY."**  
> — *O₂ METERING ACTIVE · MUSK COLONY CORP.*

- **라이브 배포 URL (GitHub Pages):** https://ssw0314-ops.github.io/muskpunk-2065/
- **GitHub 레포지토리:** https://github.com/ssw0314-ops/muskpunk-2065
- **100% 오프라인 단일 빌드 아티팩트:** [arcadia_mars_3d_prototype.html](file:///home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/c1ee4bb6-03c5-4e8a-8a56-fcabe22f4620/arcadia_mars_3d_prototype.html) ([index.html](file:///home/antigravity/arcadia-3d/index.html))
- **GDD (게임 디자인 문서):** [muskpunk_mars_mmorpg_gdd.md](file:///home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/c1ee4bb6-03c5-4e8a-8a56-fcabe22f4620/muskpunk_mars_mmorpg_gdd.md)

---

## 1. 세계관 & 프로젝트 개요

**MUSKPUNK 2065 (Project Arcadia)** 는 2065년 화성 아르카디아 평원(Arcadia Planitia)에 건설된 기업 독점 식민지(**MUSK COLONY CORP.**)를 배경으로 한 **1.6km × 1.6km 오픈월드 WebGL2 3D 샌드박스 프로토타입**입니다.

- **핵심 무드:** 압도적인 기술적 경이로움(212m 스테인리스 스틸 거상, 55m 스타쉽 메가포트, 거대 바이오돔)과 산소 계량(`O₂ Metering Active`) 기반의 기업 독점 디스토피아가 공존하는 **화성 푸른 노을(Mars Blue Sunset · Mie Scattering)** 세계관.
- **플레이 방식:** SpaceX 콜드-가스(Cold-Gas $N_2/CO_2$ COPV) 비행 추진기와 좌우 RCS 자세제어 스러스터가 탑재된 **Tesla Roadster Rocket-M**을 타고 지상 주행·수직 상승/하강 비행하거나, 언제든 하차(`F`)하여 0.38G 도보(EVA 수트 및 실내 지구식 복장 자동 전환)로 스카이브리지 카페·바이오돔 내부까지 탐험할 수 있습니다.

---

## 2. 지금까지 진행한 주요 작업 타임라인

### Phase 1. 3D 오픈월드 기반 구축 & Blender 5.0 에셋 파이프라인
- **Blender 5.0 (`bpy`) + TripoSR 기반 3D 에셋 파이프라인**([blender_pipeline/](file:///home/antigravity/arcadia-3d/blender_pipeline)) 구축 및 전 에셋을 **Gzip + Base64 인라인 GLB**로 패키징해 외부 서버나 CDN 없이 단일 HTML 파일(`~4.7MB`)로 동작하도록 설계.
- **19종 3D 월드 에셋 업그레이드 통합**:
  - **212m 일론 머스크 거상 (`AD ASTRA`)**: [colossus.js](file:///home/antigravity/arcadia-3d/src/assets/colossus.js) / [rebuild_musk_colossus_hd.py](file:///home/antigravity/arcadia-3d/blender_pipeline/rebuild_musk_colossus_hd.py)
  - **Tesla Roadster Rocket-M (플레이어 & AI 트래픽/메데박)**: [player_roadster.js](file:///home/antigravity/arcadia-3d/src/player_roadster.js), [roadster.js](file:///home/antigravity/arcadia-3d/src/assets/roadster.js)
  - **55m SpaceX Starship V4 & 메가포트 (14기 플릿)**: [starship.js](file:///home/antigravity/arcadia-3d/src/assets/starship.js)
  - **Arcadia 바이오돔 단지 & 스카이브리지 전망 카페 & 거주민**: [domes.js](file:///home/antigravity/arcadia-3d/src/assets/domes.js)
  - **Tesla Optimus Gen-3 휴머노이드 & CyberRover 작업대**: [optimus.js](file:///home/antigravity/arcadia-3d/src/assets/optimus.js)
  - **레드 캐니언 스턴트 협곡, 러스티 스타쉽 살룬, 빙하 채굴장, 380m 고가 자기부상 메트로**: [world_expansion.js](file:///home/antigravity/arcadia-3d/src/assets/world_expansion.js)

### Phase 2. 플라잉 로드스터 RCS 자세제어 & 액티브 하강 시스템
- **좌우 RCS 자세제어 분사([player_roadster.js](file:///home/antigravity/arcadia-3d/src/player_roadster.js))**: 조향 및 호버링 시 좌우 6개 노즐(`fl, fr, rl, rr, ml, mr`)에서 초음속 콜드-가스 충격파 콘과 볼류메트릭 질소 구름이 실시간 분사되도록 구현.
- **액티브 콜드-가스 역추진 하강 (`Q / Ctrl / X`, 모바일 `RETRO 하강`)**: 비행 중 상부 역추진 스러스터를 분사해 원하는 고도로 빠르게 하강 및 정밀 착륙 가능 (`V/S m/s` 수직 속도계 연동).
- **방해 요소 제거**: 공중에 떠 있던 푸른 원반형 비행 링 게이트를 월드·미니맵·HUD에서 전면 제거하여 시야를 실사풍으로 정리.

### Phase 3. 실사 영화급 GPU 볼류메트릭 구름 엔진 & 6대 절차적 GLSL 셰이더
- **GPU 인스턴싱 볼류메트릭 프랙탈 구름 엔진([volumetric_clouds.js](file:///home/antigravity/arcadia-3d/src/vfx/volumetric_clouds.js))**:
  - 단일 `InstancedMesh` 드로우콜(최대 2,200 퍼프) + 5-옥타브 FBM 3D 노이즈 + Beer-Lambert 광투과 + Henyey-Greenstein 전방 산란 + 랩터 엔진 코어 흑체 복사 발광(Blackbody incandescence) + 240 파티클 0.38G 탄도 레골리스 파편 시스템(`createLaunchEjectaSystem`).
- **6대 시네마틱 GLSL 셰이더([cinematic_shaders.js](file:///home/antigravity/arcadia-3d/src/vfx/cinematic_shaders.js))**:
  1. **하늘 & 볼류메트릭 갓레이**: [sky.js](file:///home/antigravity/arcadia-3d/src/sky.js) — 기본 시간대를 **`blueSunset` (화성 푸른 노을 · Mie Scattering)** 으로 설정.
  2. **화성 지형 트라이플래너 암벽 & 반짝이는 바람 사구(Aeolian Micro-Ripples)**: [terrain.js](file:///home/antigravity/arcadia-3d/src/terrain.js)
  3. **거상 & 스타쉽 30X 용접 스테인리스 스틸 이방성(Anisotropic) 반사 및 하단 화성 먼지 축적**
  4. **바이오돔 복층 여압 유리 박막 간섭(Thin-Film Iridescence) & 빗각 프레넬**
  5. **빙하 채굴장 심층 얼음 서브서피스 스캐터링(Subsurface Scattering)**
  6. **랩터 3 마하 다이아몬드(Mach Diamonds) 초음속 충격파 플룸**

### Phase 4. 212m 일론 머스크 거상 HD 얼굴 복원 & 용접 스틸 코트 조율
- **HD 인물 두상(`MuskHeadHD`, 28,129 폴리곤)**: [rebuild_musk_colossus_hd.py](file:///home/antigravity/arcadia-3d/blender_pipeline/rebuild_musk_colossus_hd.py)에서 원본 레퍼런스(`elon_head_hd_ref_1795135951526.jpg`)와 서브픽셀 정합을 수행하고, 가로 늘어짐(`0.88×`) 보정 + Taubin 볼륨 보존 디노이즈 + 이목구비 3D 릴리프 조각 및 실린더 UV 기반 PBR 맵 3종(`768²` Albedo, `768²` Normal, `512²` Cavity Roughness -> [colossus_head_tex_data.js](file:///home/antigravity/arcadia-3d/src/assets/colossus_head_tex_data.js))을 베이킹.
- **몸체 코트(`MuskCoat30X`, 9,076 폴리곤)**: 과도하게 각진 로우폴리 대신 원본 초안의 매끄럽고 묵직한 30X 용접 스테인리스 스틸 코트 메쉬와 `steelColor / steelNormal / steelRough` PBR 재질로 복원.

### Phase 5. 메가포트 스타쉽 광역 분산 배치 & 고고도 자연 하강/상승
- **메가포트 광역 분산([starship.js](file:///home/antigravity/arcadia-3d/src/assets/starship.js#L651-L672))**: 실제 Starbase 레퍼런스처럼 14기 스타쉽 간격을 **150~165m**(`x = 90..800, z = -535..-848`)로 넓게 분산하고, 발사·착륙 빈도를 기존 대비 **50%** 로 완화해 여유롭고 웅장한 연출 달성.
- **고고도 연속 상승 & 하강([starship.js](file:///home/antigravity/arcadia-3d/src/assets/starship.js#L1295-L1355))**:
  - 상승(`ascent`) 시 카메라 시야 상단 밖인 **고도 `1,450m` 이상**까지 완전히 올라간 뒤 궤도 대기(`orbit_wait`)로 전환.
  - 착륙 진입(`belly_flop`) 시 하늘 중간에서 갑자기 나타나는 현상(pop-in)을 없애고 **고도 `1,400m`(화면 최상단 훨씬 위)** 에서부터 대기 항력 감속 및 날개 끝 응결 궤적(wisp)을 남기며 부드럽게 활강.
  - 고도 `210m` 이하 착륙 역추진(`landing_burn`) 전환 시 랩터 화염이 `1.2초`에 걸쳐 부드럽게 점화(`burnRamp`)되도록 구현.

### Phase 6. 초기 로딩 바, 시작 화면 구도 & MUSKPUNK 2065 디스토피아 브랜딩
- **로고 전용 초기 부트 로더 (`#boot-loader`)**:
  - 최초 접속 시 화면 중앙에 **`MUSKPUNK 2065` 투명 WebP 로고와 로딩 바**만 먼저 출력.
  - 6종 3D GLB 에셋 압축 해제 및 PBR 텍스처·셰이더 워밍업 진행률을 실시간 추적([main.js](file:///home/antigravity/arcadia-3d/src/main.js#L550-L580), [main.js](file:///home/antigravity/arcadia-3d/src/main.js#L1240-L1265))하여 100% 완료 후 시작 화면을 페이드인.
- **시작 화면 시네마틱 구도 (`INTRO_CAM_DESKTOP` / `INTRO_CAM_PORTRAIT`)**:
  - 좌측 212m 거상의 압도적 위용 + 거상 앞에서 콜드-가스 리프트와 RCS를 뿜으며 호버링하는 로드스터 + 중앙 바이오돔 + 우측 상단 `MUSKPUNK 2065` 로고 아래로 실시간 발사·착륙하는 스타쉽을 한 프레임에 배치.
- **디스토피아 타이틀 카피 & 통일된 타이포그래피 ([build-standalone.mjs](file:///home/antigravity/arcadia-3d/build-standalone.mjs#L88-L165), [build-standalone.mjs](file:///home/antigravity/arcadia-3d/build-standalone.mjs#L465-L478))**:
  - 구구절절한 스펙·조작 설명을 모두 제거하고 버튼(`ACCEPT TERMS & BREATHE`)과 동일한 헤비 산세리프 영문 폰트(`font-weight: 900`, `uppercase`)로 전체 통일:
    - `HE GAVE US MARS. HE OWNS THE AIR.`
    - `WELCOME TO MARS. TERMS APPLY.`
    - `[ ACCEPT TERMS & BREATHE ]`  `O₂ METERING ACTIVE · MUSK COLONY CORP.`

---

## 3. 디렉토리 및 핵심 파일 구조

```text
/home/antigravity/arcadia-3d/
├── index.html                        # GitHub Pages 배포용 단일 100% 오프라인 HTML (~4.7MB)
├── build-standalone.mjs              # Rollup 번들 + 로고 Data URI + HTML/CSS 통합 빌드 스크립트
├── rollup.config.mjs                 # Three.js 및 모듈 번들링 설정
├── blender_pipeline/
│   ├── rebuild_musk_colossus_hd.py   # Blender 5.0 212m 거상(9K 용접 코트 + 28K HD 두상 & PBR 베이킹)
│   ├── process_logo.py               # 첨부 로고 검은 배경 알파 키잉 & 화성 구체 보존 WebP 변환기
│   └── muskpunk_logo.webp            # 투명 배경 MUSKPUNK 2065 타이틀 로고
└── src/
    ├── main.js                       # 렌더 루프, 부트 로더 진행률, 인트로 카메라, GTA 체이스캠/도보 제어
    ├── player_roadster.js            # 플레이어 플라잉 로드스터 물리, 콜드-가스 상승/하강, 6-노즐 RCS
    ├── sky.js                        # 화성 푸른 노을(blueSunset) 등 4종 대기 산란 스카이돔
    ├── terrain.js                    # 1.6km × 1.6km 절차적 화성 지형 높이맵 & 트라이플래너 셰이더
    ├── textures.js                   # 절차적 PBR 텍스처 생성기 (30X 스틸, 현무암, TPS 타일 등)
    ├── minimap.js                    # GTA 스타일 회전형 전술 레이더 미니맵 & 구역 감지
    ├── audio.js                      # WebAudio 절차적 사운드 신디사이저 (랩터 럼블, 콜드-가스 스러스터)
    ├── vfx/
    │   ├── volumetric_clouds.js      # GPU 인스턴싱 볼류메트릭 프랙탈 구름 & 0.38G 탄도 파편 엔진
    │   └── cinematic_shaders.js      # 6대 절차적 GLSL 시네마틱 셰이더 & 갓레이
    └── assets/
        ├── colossus.js               # 212m 일론 머스크 거상 & 34.4m 현무암 성채 받침대
        ├── starship.js               # 55m 스타쉽 V4 14기 메가포트 & 고고도(1400m+) 발사/착륙 루프
        ├── roadster.js               # 테슬라 로드스터 Rocket-M 메쉬 빌더 & AI 비행 트래픽
        ├── domes.js                  # 바이오돔 단지, 스카이브리지 전망 카페, 거주민 NPC
        ├── optimus.js                # 옵티머스 Gen-3 휴머노이드 & 사이버로버
        ├── world_expansion.js        # 레드 캐니언, 스타쉽 살룬, 빙하 채굴장, 고가 메트로
        └── *_glb_data.js             # Gzip+Base64 인라인 Blender 5.0 3D 메쉬 & PBR 데이터
```

---

## 4. 빌드 및 GitHub Pages 배포 명령어

코드나 UI를 수정한 뒤 아래 명령으로 로컬 아티팩트와 GitHub Pages(`https://ssw0314-ops.github.io/muskpunk-2065/`)를 동시에 업데이트할 수 있습니다.

```bash
cd /home/antigravity/arcadia-3d
./node_modules/.bin/rollup -c rollup.config.mjs && node build-standalone.mjs
cp dist/arcadia_mars_3d_prototype.html index.html
cp dist/arcadia_mars_3d_prototype.html /home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/c1ee4bb6-03c5-4e8a-8a56-fcabe22f4620/arcadia_mars_3d_prototype.html
git add -A && git commit -m "Update MUSKPUNK 2065" && git push origin main
```
