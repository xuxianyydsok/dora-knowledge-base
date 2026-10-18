import { render } from 'preact';
import './styles/fonts.css';
import './styles/global.css';
// 动效小组件（2026-10-15，来自用户挑选的图鉴，见 components/MotionFx.jsx）
import './styles/motion.css';
import { App } from './app.jsx';

// 应用入口
render(<App />, document.getElementById('app'));
