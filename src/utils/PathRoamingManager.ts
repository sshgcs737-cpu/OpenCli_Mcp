import * as Cesium from "cesium";

/**
 * UI交互接口
 */
export interface IPathRoamingUI {
  // 显示点高度输入对话框
  showHeightDialog(callback: (height: number) => void): void;

  // 显示路径名称输入对话框
  showNameDialog(callback: (name: string) => void): void;

  // 更新路径列表
  updatePathList(paths: { id: string; name: string }[]): void;

  // 更新按钮状态
  updateDrawButtonState(isDrawing: boolean): void;

  // 显示消息
  showMessage(message: string, type: string): void;
}

interface PathEntity {
  id: string;
  name: string;
  positions: PathPosition[];
  pointEntities: Cesium.Entity[];
  lineEntities: Cesium.Entity[];
}

interface PathPosition {
  longitude: number;
  latitude: number;
  height: number;
}

/**
 * 路径漫游管理器
 * 负责管理路径绘制、保存等功能
 * 使用单例模式确保全局只有一个实例，便于数据共享
 */
export class PathRoamingManager {
  // 单例实例
  private static instance: PathRoamingManager;

  // Cesium地图查看器实例，用于操作三维场景
  private viewer: Cesium.Viewer;
  // 事件处理器，用于捕获鼠标事件
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  // 当前是否处于绘制状态
  private isDrawing: boolean = false;
  // 保存的路径实体列表，包含所有已绘制和保存的路径
  private pathEntityList: PathEntity[] = [];
  // UI接口，用于与用户界面交互
  private ui: IPathRoamingUI | null = null;

  // 临时绘制状态存储
  // 活动点位置数组，包含当前绘制路径的所有点坐标
  private activePoints: Cesium.Cartesian3[] = [];
  // 点实体数组，存储绘制的所有点实体
  private pointEntities: Cesium.Entity[] = [];
  // 线实体数组，存储绘制的所有线段实体
  private lineEntities: Cesium.Entity[] = [];
  // 浮动点实体，用于跟随鼠标移动，显示实时预览点
  private floatingPoint: Cesium.Entity | undefined;
  // 活动形状实体，用于显示动态预览线段
  private activeShape: Cesium.Entity | undefined;

  // 路径平滑配置
  private smoothingEnabled: boolean = true; // 是否启用路径平滑
  private arcRadius: number = 15; // 基础圆弧半径（米）
  private minArcRadius: number = 10; // 最小转弯半径（米）
  private radiusAdjustFactor: number = 0.8; // 半径调节系数

  /**
   * 私有构造函数，防止外部直接创建实例
   */
  private constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  /**
   * 获取PathRoamingManager的单例实例
   * @param viewer Cesium查看器实例
   * @returns PathRoamingManager实例
   */
  public static getInstance(viewer: Cesium.Viewer): PathRoamingManager {
    if (!PathRoamingManager.instance) {
      PathRoamingManager.instance = new PathRoamingManager(viewer);
    } else if (PathRoamingManager.instance.viewer !== viewer) {
      // 如果传入的viewer与当前实例的viewer不同，则更新viewer
      PathRoamingManager.instance.setViewer(viewer);
    }
    return PathRoamingManager.instance;
  }

  /**
   * 设置新的Viewer实例
   * @param viewer 新的Cesium查看器实例
   */
  private setViewer(viewer: Cesium.Viewer): void {
    // 如果当前有绘制或移动任务，先清理
    if (this.isDrawing) {
      this.endDrawing();
    }

    this.viewer = viewer;
  }

  /**
   * 设置UI接口
   */
  public setUI(ui: IPathRoamingUI): void {
    this.ui = ui;
  }

  // 这里将实现各个功能模块的方法

  /**
   * 开始绘制路径
   */
  public startDrawing(): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    this.resetDrawingState();
    this.setupEventHandlers();

    // 更新UI状态
    if (this.ui) {
      this.ui.updateDrawButtonState(true);
    }
  }

  /**
   * 结束绘制
   */
  public endDrawing(): void {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    this.removeEventHandlers();
    this.clearTemporaryEntities();
  }

  /**
   * 重置绘制状态
   */
  private resetDrawingState(): void {
    this.activePoints = [];
    this.pointEntities = [];
    this.lineEntities = [];
    this.floatingPoint = undefined;
    this.activeShape = undefined;
  }

  /**
   * 清除临时实体
   */
  private clearTemporaryEntities(): void {
    // 移除所有未保存的临时点和线
    this.pointEntities.forEach((entity) => this.viewer.entities.remove(entity));
    this.lineEntities.forEach((entity) => this.viewer.entities.remove(entity));

    if (this.floatingPoint) {
      this.viewer.entities.remove(this.floatingPoint);
      this.floatingPoint = undefined;
    }

    if (this.activeShape) {
      this.viewer.entities.remove(this.activeShape);
      this.activeShape = undefined;
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // 鼠标左键点击事件 - 创建路径点
    this.handler.setInputAction(
      this.handleLeftClick.bind(this), // 将原始函数的this（即PathRoamingManager类实例）永久绑定到当前上下文
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    // 鼠标移动事件 - 动态预览
    this.handler.setInputAction(
      this.handleMouseMove.bind(this),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
  }

  /**
   * 移除事件处理器
   */
  private removeEventHandlers(): void {
    if (this.handler) {
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      this.handler = null;
    }
  }

  /**
   * 处理左键点击
   */
  private handleLeftClick(event: any): void {
    if (!this.isDrawing) return;

    const earthPosition = this.viewer.scene.pickPosition(event.position);
    if (!Cesium.defined(earthPosition)) return;


    // 第一个点处理
    if (this.activePoints.length === 0) {
      // 创建第一个点实体
      const pointEntity = this.createPoint(earthPosition);
      this.pointEntities.push(pointEntity);

      // 存储第一个点位置
      this.activePoints.push(earthPosition);

      // 创建浮动点(用于实时预览)
      this.floatingPoint = this.createPoint(earthPosition.clone());

      // 创建动态线(用于实时预览)
      const dynamicPositions = new Cesium.CallbackProperty(() => {
        // 返回所有固定点和浮动点的位置数组
        return this.activePoints;
      }, false);

      this.activeShape = this.drawLine(dynamicPositions);
      this.lineEntities.push(this.activeShape);

      // 给浮动点添加一个位置，使其可以在鼠标移动时更新
      this.activePoints.push(earthPosition.clone());
    } else {
      // 非第一个点的处理

      // 移除当前的浮动点位置(保留固定点的位置)
      this.activePoints.pop();

      // 添加新的固定点位置
      this.activePoints.push(earthPosition);

      // 创建新的点实体
      const pointEntity = this.createPoint(earthPosition);
      this.pointEntities.push(pointEntity);

      // 添加新的浮动点位置(初始与刚点击的点相同)
      this.activePoints.push(earthPosition.clone());
    }

    // 弹出高度设置对话框
    this.promptForHeight(this.pointEntities.length - 1);

  }

  /**
   * 处理鼠标移动
   */
  private handleMouseMove(event: any): void {
    if (!this.isDrawing || this.activePoints.length < 2) return;

    const newPosition = this.viewer.scene.pickPosition(event.endPosition);
    if (!Cesium.defined(newPosition)) return;

    // 只更新最后一个点(浮动点)的位置
    const lastIndex = this.activePoints.length - 1;
    this.activePoints[lastIndex] = newPosition;

    // 如果有浮动点实体，更新其位置
    if (this.floatingPoint) {
      (this.floatingPoint.position as any).setValue(newPosition);
    }
  }

  /**
   * 创建点实体
   */
  private createPoint(position: Cesium.Cartesian3): Cesium.Entity {
    return this.viewer.entities.add({
      position: position,
      point: {
        color: Cesium.Color.RED,
        pixelSize: 10,
        heightReference: Cesium.HeightReference.NONE, // 使用绝对高度
      },
    });
  }

  /**
   * 绘制线实体
   */
  private drawLine(positions: any): Cesium.Entity {
    return this.viewer.entities.add({
      polyline: {
        positions: positions,
        width: 3,
        material: Cesium.Color.YELLOW,
        clampToGround: false, // 不贴地，使用绝对高度
        arcType: Cesium.ArcType.NONE, // 使用直线连接点,而不是大圆弧
      },
    });
  }

  /**
   * 结束路径绘制
   */
  private terminatePathDrawing(): void {

    // 清理动态线段
    if (this.activeShape) {
      this.viewer.entities.remove(this.activeShape);

      // 从线实体集合中移除
      const index = this.lineEntities.indexOf(this.activeShape);
      if (index !== -1) {
        this.lineEntities.splice(index, 1);
      }

      this.activeShape = undefined;
    }

    // 清理浮动点
    if (this.floatingPoint) {
      this.viewer.entities.remove(this.floatingPoint);
      this.floatingPoint = undefined;
    }

    // 添加最终路径线（如果有足够的点）
    if (this.activePoints.length >= 2) {
      const finalLine = this.drawLine(this.activePoints);
      this.lineEntities.push(finalLine);
    }

    // 弹出路径命名对话框
    this.promptForPathName();
  }

  /**
   * 提示输入高度
   */
  public promptForHeight(pointIndex: number): void {
    // 这个方法将通过回调与UI交互，获取用户输入的高度
    // 实现交由UI层，这里仅定义接口
  }

  /**
   * 设置点高度
   */
  public setPointHeight(pointIndex: number, height: number): void {
    if (pointIndex < 0 || pointIndex >= this.pointEntities.length) return;

    const point = this.pointEntities[pointIndex];
    if (!point.position) return;

    const position = point.position.getValue(Cesium.JulianDate.now());
    if (!position) return;

    // 获取经纬度
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);

    // 创建新的带高度的位置
    const newPosition = Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      height
    );
    point.position = new Cesium.ConstantPositionProperty(newPosition);

    // 更新活动点数组
    this.activePoints[pointIndex] = newPosition;

    // 更新线
    this.updateLines();
  }

  /**
   * 更新线段
   */
  private updateLines(): void {

    // 保存最后一个点（浮动点）
    const lastPoint =
      this.activePoints.length > 0
        ? this.activePoints[this.activePoints.length - 1].clone()
        : null;

    // 移除动态线段
    if (this.activeShape) {
      this.viewer.entities.remove(this.activeShape);

      // 从线实体集合中移除
      const index = this.lineEntities.indexOf(this.activeShape);
      if (index !== -1) {
        this.lineEntities.splice(index, 1);
      }

      this.activeShape = undefined;
    }

    // 移除其他静态线段
    this.lineEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.lineEntities = [];

    // 如果有浮动点，临时从activePoints中移除，避免它被包含在静态线段中
    if (lastPoint) {
      this.activePoints.pop();
    }

    // 创建静态线段（如果有足够的点）
    if (this.activePoints.length >= 2) {
      this.lineEntities.push(this.drawLine(this.activePoints));
    }

    // 如果有浮动点，重新添加到activePoints以恢复动态预览
    if (lastPoint) {
      this.activePoints.push(lastPoint);

      // 重新创建动态线段
      const dynamicPositions = new Cesium.CallbackProperty(() => {
        return this.activePoints;
      }, false);

      this.activeShape = this.drawLine(dynamicPositions);
      this.lineEntities.push(this.activeShape);
    }
  }

  /**
   * 提示输入路径名称
   */
  public promptForPathName(): void {
    // 这个方法将通过回调与UI交互，获取用户输入的路径名称
    // 实现交由UI层，这里仅定义接口
  }

  /**
   * 保存路径
   */
  public savePath(name: string): string {
    // 转换所有点位为经纬度高度格式
    const positions: PathPosition[] = this.convertToPathPositions(
      this.activePoints
    );

    // 创建路径实体
    const pathId = Cesium.createGuid();
    this.pathEntityList.push({
      id: pathId,
      name: name,
      positions: positions,
      pointEntities: [...this.pointEntities],
      lineEntities: [...this.lineEntities],
    });

    // 重置绘制状态
    this.activePoints = [];
    this.pointEntities = [];
    this.lineEntities = [];

    return pathId;
  }

  /**
   * 获取所有路径
   */
  public getAllPaths(): { id: string; name: string }[] {
    return this.pathEntityList.map((path) => ({
      id: path.id,
      name: path.name,
    }));
  }

  /**
   * 删除路径
   */
  public deletePath(pathId: string): boolean {
    const index = this.pathEntityList.findIndex((path) => path.id === pathId);
    if (index === -1) return false;

    // 删除所有实体
    const path = this.pathEntityList[index];
    path.pointEntities.forEach((entity) => this.viewer.entities.remove(entity));
    path.lineEntities.forEach((entity) => this.viewer.entities.remove(entity));

    // 从列表移除
    this.pathEntityList.splice(index, 1);
    return true;
  }

  /**
   * 销毁管理器
   */
  public destroy(): void {
    // 清理所有实体和事件
    this.removeEventHandlers();

    // 删除所有路径
    this.pathEntityList.forEach((path) => {
      path.pointEntities.forEach((entity) =>
        this.viewer.entities.remove(entity)
      );
      path.lineEntities.forEach((entity) =>
        this.viewer.entities.remove(entity)
      );
    });

    this.pathEntityList = [];
  }

  /**
   * 取消绘制，清理所有临时实体
   */
  public cancel(): void {
    // 如果正在绘制，结束绘制
    if (this.isDrawing) {
      // 结束绘制状态
      this.isDrawing = false;
      
      // 移除事件处理器
      this.removeEventHandlers();
      
      // 清除所有临时实体
      this.clearTemporaryEntities();
      
      // 重置绘制状态
      this.resetDrawingState();
      
      // 通知UI更新按钮状态
      if (this.ui) {
        this.ui.updateDrawButtonState(false);
      }
      
    }
  }

  /**
   * 完成绘制并保存路径
   * 这是一个公共方法，允许从UI触发路径完成操作
   */
  public finishDrawingPath(): void {
    if (!this.isDrawing) return;


    // 如果有浮动点（即最后一个点），移除它
    if (this.activePoints.length > 1) {
      // 移除最后一个浮动点
      this.activePoints.pop();
    }

    // 只有在有足够的点时才保存路径
    if (this.activePoints.length >= 2) {

      // 应用路径平滑算法（圆弧过渡）- 确保总是应用平滑
      if (this.smoothingEnabled && this.activePoints.length > 2) {
        this.activePoints = this.smoothPath(this.activePoints, this.arcRadius);
      }

      // 更新可视化路径
      this.updatePathVisualization();

      // 终止路径绘制（保留点和线，并显示命名对话框）
      this.terminatePathDrawing();
    } else {
      // 如果点数不足，只是结束绘制但不触发命名对话框
      this.endDrawing();

      // 显示提示信息
      if (this.ui) {
        this.ui.showMessage(
          "路径点数量不足，至少需要两个点才能保存路径",
          "warning"
        );
      }
    }

    // 更新绘制状态
    this.isDrawing = false;

    // 清理事件处理器
    this.removeEventHandlers();

    // 通知UI更新按钮状态
    if (this.ui) {
      this.ui.updateDrawButtonState(false);
    }
  }

  /**
   * 路径平滑处理函数，在线段交点处添加圆弧过渡
   * @param pathPoints 原始路径点数组
   * @param arcRadius 基础圆弧半径（米）
   * @returns 平滑后的路径点数组
   */
  private smoothPath(
    pathPoints: Cesium.Cartesian3[],
    arcRadius: number
  ): Cesium.Cartesian3[] {
    if (pathPoints.length < 3) return pathPoints;

    const smoothedPath: Cesium.Cartesian3[] = [];
    smoothedPath.push(pathPoints[0]);

    for (let i = 1; i < pathPoints.length - 1; i++) {
      const A = pathPoints[i - 1];
      const B = pathPoints[i];
      const C = pathPoints[i + 1];

      // 向量 v1 = B → A，v2 = B → C
      const v1 = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(A, B, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );
      const v2 = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(C, B, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );

      // 角度与半角
      const cosAngle = Cesium.Cartesian3.dot(v1, v2);
      const angle = Math.acos(Cesium.Math.clamp(cosAngle, -1.0, 1.0));
      const halfAngle = angle / 2;

      // 计算角平分线方向（向内）
      const bisector = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.add(v1, v2, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );

      // 切点到B点的距离
      const tangentDist = arcRadius / Math.tan(halfAngle);

      // 限制不能超出线段长度
      const v1Length = Cesium.Cartesian3.distance(A, B);
      const v2Length = Cesium.Cartesian3.distance(B, C);
      const maxDist = Math.min(v1Length, v2Length) * 0.4;
      const actualTangentDist = Math.min(tangentDist, maxDist);

      // 切点
      const tangentPoint1 = Cesium.Cartesian3.add(
        B,
        Cesium.Cartesian3.multiplyByScalar(
          v1,
          actualTangentDist,
          new Cesium.Cartesian3()
        ),
        new Cesium.Cartesian3()
      );
      const tangentPoint2 = Cesium.Cartesian3.add(
        B,
        Cesium.Cartesian3.multiplyByScalar(
          v2,
          actualTangentDist,
          new Cesium.Cartesian3()
        ),
        new Cesium.Cartesian3()
      );

      // 圆心：从B沿角平分线推 arcRadius / sin(halfAngle)
      const centerOffset = arcRadius / Math.sin(halfAngle);
      const center = Cesium.Cartesian3.add(
        B,
        Cesium.Cartesian3.multiplyByScalar(
          bisector,
          centerOffset,
          new Cesium.Cartesian3()
        ),
        new Cesium.Cartesian3()
      );

      // 添加第一个切点
      smoothedPath.push(tangentPoint1);

      // 在圆弧上插入中间点
      // 动态计算圆弧点数量，增加点数以提高平滑度
      const basePointCount = 3;
      const dynamicFactor = 5;
      const extraPoints = Math.ceil(dynamicFactor * (Math.PI - angle));
      const numArcPoints = basePointCount + extraPoints;
      this.generateArcPoints(
        center,
        tangentPoint1,
        tangentPoint2,
        numArcPoints,
        smoothedPath
      );

      // 添加第二个切点
      smoothedPath.push(tangentPoint2);
    }

    smoothedPath.push(pathPoints[pathPoints.length - 1]);
    return smoothedPath;
  }

  /**
   * 在两个切点之间生成圆弧上的点
   */
  private generateArcPoints(
    center: Cesium.Cartesian3,
    start: Cesium.Cartesian3,
    end: Cesium.Cartesian3,
    numPoints: number,
    outputArray: Cesium.Cartesian3[]
  ): void {
    // 计算起点相对于圆心的向量
    const startVec = Cesium.Cartesian3.subtract(
      start,
      center,
      new Cesium.Cartesian3()
    );
    const endVec = Cesium.Cartesian3.subtract(
      end,
      center,
      new Cesium.Cartesian3()
    );

    // 计算法向量（垂直于圆弧平面）
    const normal = Cesium.Cartesian3.cross(
      startVec,
      endVec,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(normal, normal);

    // 计算半径
    const radius = Cesium.Cartesian3.magnitude(startVec);

    // 计算起点和终点之间的角度
    const startMag = Cesium.Cartesian3.magnitude(startVec);
    const endMag = Cesium.Cartesian3.magnitude(endVec);
    const cosAngle =
      Cesium.Cartesian3.dot(startVec, endVec) / (startMag * endMag);
    const totalAngle = Math.acos(Cesium.Math.clamp(cosAngle, -1.0, 1.0));

    // 检查旋转方向（顺时针或逆时针）
    const crossResult = Cesium.Cartesian3.cross(
      startVec,
      endVec,
      new Cesium.Cartesian3()
    );
    const direction = Cesium.Cartesian3.dot(crossResult, normal) > 0 ? 1 : -1;

    // 生成中间点
    for (let i = 1; i < numPoints - 1; i++) {
      const fraction = i / (numPoints - 1);
      const angle = totalAngle * fraction * direction;

      // 使用四元数旋转向量
      const rotation = Cesium.Quaternion.fromAxisAngle(normal, angle);
      const rotatedVec = Cesium.Matrix3.multiplyByVector(
        Cesium.Matrix3.fromQuaternion(rotation),
        startVec,
        new Cesium.Cartesian3()
      );

      // 生成圆弧上的点
      const arcPoint = Cesium.Cartesian3.add(
        center,
        rotatedVec,
        new Cesium.Cartesian3()
      );
      outputArray.push(arcPoint);
    }
  }

  /**
   * 更新路径可视化
   * 在路径平滑后更新路径的可视化效果
   */
  private updatePathVisualization(): void {
    // 移除所有现有的点实体和线实体（除了浮动点和活动形状）
    this.pointEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.pointEntities = [];

    this.lineEntities.forEach((entity) => {
      if (entity !== this.activeShape) {
        this.viewer.entities.remove(entity);
      }
    });
    this.lineEntities = this.lineEntities.filter((e) => e === this.activeShape);

    // 为平滑后的每个点创建新的点实体
    for (const point of this.activePoints) {
      const pointEntity = this.createPoint(point);
      this.pointEntities.push(pointEntity);
    }

    // 创建新的线实体来表示平滑路径
    const smoothLineEntity = this.drawLine(this.activePoints);
    this.lineEntities.push(smoothLineEntity);
  }

  /**
   * 将采样点转换为路径位置数组
   */
  private convertToPathPositions(points: Cesium.Cartesian3[]): PathPosition[] {
    return points.map((position) => {
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      return {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height,
      };
    });
  }

  /**
   * 设置路径平滑参数
   * @param enabled 是否启用路径平滑
   * @param radius 基础圆弧半径（米）
   * @param minRadius 最小转弯半径（米）
   * @param adjustFactor 半径调节系数
   */
  public setPathSmoothingOptions(
    enabled: boolean,
    radius?: number,
    minRadius?: number,
    adjustFactor?: number
  ): void {
    this.smoothingEnabled = enabled;

    if (radius !== undefined && radius > 0) {
      this.arcRadius = radius;
    }

    if (minRadius !== undefined && minRadius > 0) {
      this.minArcRadius = minRadius;
    }

    if (adjustFactor !== undefined && adjustFactor >= 0) {
      this.radiusAdjustFactor = adjustFactor;
    }

  }

  /**
   * 获取指定路径ID的路径数据
   * @param pathId 路径ID
   * @returns 路径数据，如果不存在则返回null
   */
  public getPathData(pathId: string): PathPosition[] | null {
    const path = this.pathEntityList.find((p) => p.id === pathId);
    if (!path) return null;
    return path.positions;
  }

  /**
   * 预览路径
   * @param pathId 要预览的路径ID
   * @returns 是否成功预览路径
   */
  public previewPath(pathId: string): boolean {
    const path = this.pathEntityList.find((p) => p.id === pathId);
    if (!path) return false;

    // 调整相机视角到路径的位置
    this.zoomToPath(path);
    return true;
  }

  /**
   * 调整相机视角到路径
   * @param path 要查看的路径实体
   */
  private zoomToPath(path: PathEntity): void {
    // 从路径位置创建Cartesian3数组
    const positions = path.positions.map((pos) =>
      Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.height)
    );

    if (positions.length === 0) return;

    // 创建包含所有点的包围球
    const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);

    // 使用相机飞到这个范围
    this.viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 1.5, // 移动时间（秒）
      offset: new Cesium.HeadingPitchRange(0, -Math.PI / 4, 0), // 相机视角偏移
    });
  }

  /**
   * 删除最后添加的点
   * 当用户取消设置点高度时调用
   */
  public cancelLastPoint(): void {
    if (!this.isDrawing || this.pointEntities.length === 0) return;


    // 删除最后一个点实体
    const lastPointEntity = this.pointEntities.pop();
    if (lastPointEntity) {
      this.viewer.entities.remove(lastPointEntity);
    }

    // 如果只有一个点（浮动点），则重置绘制状态
    if (this.activePoints.length <= 2) {
      // 清理所有实体
      this.clearTemporaryEntities();
      this.resetDrawingState();
      return;
    }

    // 删除活动点数组中的固定点和浮动点
    // 保留浮动点以便继续绘制
    if (this.activePoints.length >= 2) {
      // 移除浮动点
      const floatingPoint = this.activePoints.pop();
      
      // 移除固定点
      this.activePoints.pop();
      
      // 重新添加浮动点
      if (floatingPoint) {
        this.activePoints.push(floatingPoint);
      }
    }

    // 更新线段
    this.updateLines();

  }

  /**
   * 创建圆形路径
   * @param circlePoints 圆形路径的点数组
   * @param name 路径名称
   * @returns 路径ID，如果失败则返回null
   */
  public createCirclePath(circlePoints: Cesium.Cartesian3[], name: string): string | null {
    if (circlePoints.length < 3) {
      console.warn("圆形路径点数不足");
      return null;
    }

    // 为每个点创建实体
    const pointEntities: Cesium.Entity[] = [];
    const lineEntities: Cesium.Entity[] = [];

    // 创建点实体
    circlePoints.forEach(point => {
      const pointEntity = this.createPoint(point);
      pointEntities.push(pointEntity);
    });

    // 创建线实体
    const lineEntity = this.drawLine(circlePoints);
    lineEntities.push(lineEntity);

    // 转换为路径位置格式
    const positions: PathPosition[] = this.convertToPathPositions(circlePoints);

    // 创建路径实体
    const pathId = Cesium.createGuid();
    this.pathEntityList.push({
      id: pathId,
      name: name,
      positions: positions,
      pointEntities: pointEntities,
      lineEntities: lineEntities,
    });

    return pathId;
  }

  /**
   * 清理未保存的路径实体
   * 当用户取消路径命名时调用
   */
  public clearUnsavedPath(): void {
    // 清理所有点实体
    this.pointEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.pointEntities = [];
    
    // 清理所有线实体
    this.lineEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.lineEntities = [];
    
    // 重置绘制状态
    this.resetDrawingState();
    
  }
}
