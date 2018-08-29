import macro from 'vtk.js/Sources/macro';
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkPixelSpaceCallbackMapper from 'vtk.js/Sources/Rendering/Core/PixelSpaceCallbackMapper';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import vtkWidgetRepresentation from 'vtk.js/Sources/Widgets/Representations/WidgetRepresentation';

import PropertyConst from 'vtk.js/Sources/Rendering/Core/Property/Constants';

const { Interpolation } = PropertyConst;

// ----------------------------------------------------------------------------
// Representation style
// ----------------------------------------------------------------------------

// const STYLE_PIPELINE_NAMES = ['line', 'tube', 'display2D'];
const STYLE_DEFAULT = {
  active: {},
  inactive: {},
  static: {
    line: {
      color: [1, 1, 1],
      opacity: 1,
      interpolation: Interpolation.FLAT,
    },
  },
};
// ----------------------------------------------------------------------------
// vtkPolyLineRepresentation methods
// ----------------------------------------------------------------------------

function vtkPolyLineRepresentation(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPolyLineRepresentation');

  // --------------------------------------------------------------------------
  // Internal polydata dataset
  // --------------------------------------------------------------------------

  model.internalPolyData = vtkPolyData.newInstance({ mtime: 0 });
  model.cells = [];

  function allocateSize(size, closePolyLine = false) {
    if (size === 0) {
      model.internalPolyData.getPoints().setData(new Float32Array([0, 0, 0]));
      model.internalPolyData.getLines().setData(new Uint8Array(0));
    } else if (!model.points || model.points.length !== size * 3) {
      model.points = new Float32Array(size * 3);
      model.cells = new Uint8Array(size + 1 + (closePolyLine ? 1 : 0));
      model.cells[0] = model.cells.length - 1;
      for (let i = 1; i < model.cells.length; i++) {
        model.cells[i] = i - 1;
      }
      if (closePolyLine) {
        model.cells[model.cells.length - 1] = 0;
        console.log('closePolyLine', closePolyLine, model.cells);
      }
      model.internalPolyData.getPoints().setData(model.points, 3);
      model.internalPolyData.getLines().setData(model.cells);
    }
    return model.points;
  }

  // --------------------------------------------------------------------------
  // Generic rendering pipeline
  // --------------------------------------------------------------------------

  model.pipelines = {};
  model.pipelines.line = {
    source: publicAPI,
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance(),
  };
  model.pipelines.display2D = {
    source: publicAPI,
    mapper: vtkPixelSpaceCallbackMapper.newInstance(),
    actor: vtkActor.newInstance({ pickable: false }),
  };
  model.pipelines.tube = {
    source: vtkTubeFilter.newInstance({
      radius: 0.01,
      numberOfSides: 12,
      capping: false,
    }),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance(),
  };
  model.pipelines.tube.source.setInputConnection(publicAPI.getOutputPort());

  vtkWidgetRepresentation.connectPipeline(model.pipelines.tube);
  vtkWidgetRepresentation.connectPipeline(model.pipelines.line);
  vtkWidgetRepresentation.connectPipeline(model.pipelines.display2D);

  model.actors.push(model.pipelines.display2D.actor);
  model.actors.push(model.pipelines.line.actor);
  model.actors.push(model.pipelines.tube.actor);

  vtkWidgetRepresentation.applyStyles(model.pipelines, STYLE_DEFAULT);

  // --------------------------------------------------------------------------

  publicAPI.requestData = (inData, outData) => {
    const list = publicAPI.getRepresentationStates(inData[0]);
    let size = list.length;

    if (size > 1) {
      const lastState = list[list.length - 1];
      const last = lastState.getOrigin();
      const prevLast = list[list.length - 2].getOrigin();
      let delta =
        vtkMath.distance2BetweenPoints(last, prevLast) > model.threshold
          ? 0
          : 1;
      if (!delta && lastState.isVisible && !lastState.isVisible()) {
        delta++;
      }
      size -= delta;
    }

    const points = allocateSize(size, model.closePolyLine && size > 2);

    for (let i = 0; i < size; i++) {
      const coords = list[i].getOrigin();
      points[i * 3] = coords[0];
      points[i * 3 + 1] = coords[1];
      points[i * 3 + 2] = coords[2];
    }

    model.internalPolyData.modified();
    outData[0] = model.internalPolyData;
  };

  publicAPI.setDisplayCallback = (callback) => {
    model.pipelines.display2D.mapper.setCallback(callback);
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  threshold: Number.EPSILON,
  closePolyLine: false,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  vtkWidgetRepresentation.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['threshold', 'closePolyLine']);

  vtkPolyLineRepresentation(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkPolyLineRepresentation'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
